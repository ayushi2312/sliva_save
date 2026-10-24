/**
 * PyroWatch AI - Forest Fire Probability & Wildfire Risk Assessment Engine
 * Incorporates Canadian Forest Fire Weather Index (FWI) principles and
 * multi-variable logistic regression ensemble for probability estimation.
 */

// ============================================================================
// 1. DATA PRESETS & VEGETATION FACTORS
// ============================================================================

const VEGETATION_FACTORS = {
  coniferous: { name: 'Coniferous / Pine', multiplier: 1.18, spreadBase: 1.25, hint: 'Resinous needles, fast ignition (1.18x risk)' },
  deciduous: { name: 'Deciduous Hardwood', multiplier: 0.85, spreadBase: 0.80, hint: 'High moisture foliage (0.85x risk)' },
  mixed: { name: 'Mixed Forest', multiplier: 1.00, spreadBase: 1.00, hint: 'Mosaic vegetation canopy (1.00x baseline)' },
  shrubland: { name: 'Chaparral / Shrubland', multiplier: 1.25, spreadBase: 1.35, hint: 'Volatile oils & dense brush (1.25x risk)' },
  grassland: { name: 'Grassland / Savannah', multiplier: 1.15, spreadBase: 1.50, hint: 'Fine flash fuels, rapid run (1.15x risk)' }
};

const SCENARIO_PRESETS = {
  heatwave: {
    name: 'Extreme Heatwave',
    temp: 42.0,
    humidity: 14,
    wind: 38,
    rain: 0.0,
    drought: 5,
    forestType: 'coniferous',
    ffmc: 94.2,
    dmc: 72.0,
    dc: 540.0,
    isi: 22.5
  },
  'arid-windy': {
    name: 'Dry & High Winds',
    temp: 34.0,
    humidity: 22,
    wind: 56,
    rain: 0.0,
    drought: 4,
    forestType: 'shrubland',
    ffmc: 92.0,
    dmc: 58.0,
    dc: 410.0,
    isi: 26.8
  },
  moderate: {
    name: 'Typical Summer Forest',
    temp: 26.5,
    humidity: 48,
    wind: 16,
    rain: 0.8,
    drought: 3,
    forestType: 'mixed',
    ffmc: 84.0,
    dmc: 28.0,
    dc: 220.0,
    isi: 6.2
  },
  rainy: {
    name: 'Recent Rain & Humid',
    temp: 17.5,
    humidity: 86,
    wind: 12,
    rain: 18.5,
    drought: 1,
    forestType: 'deciduous',
    ffmc: 45.0,
    dmc: 8.0,
    dc: 65.0,
    isi: 1.1
  },
  drought: {
    name: 'Prolonged Drought',
    temp: 37.0,
    humidity: 19,
    wind: 24,
    rain: 0.0,
    drought: 5,
    forestType: 'coniferous',
    ffmc: 93.0,
    dmc: 88.0,
    dc: 680.0,
    isi: 15.4
  }
};

const DROUGHT_LABELS = {
  1: 'Saturated (High Moisture)',
  2: 'Normal Moisture',
  3: 'Moderate Dryness',
  4: 'Severely Parched',
  5: 'Critical Tinderbox (Drought)'
};

// ============================================================================
// 2. SCIENTIFIC COMPUTATION & ML PREDICTION ENGINE
// ============================================================================

class ForestFirePredictor {

  /**
   * Approximate Fine Fuel Moisture Code (FFMC) from weather variables.
   * Based on standard empirical FWI approximations.
   */
  static estimateFFMC(temp, rh, wind, rain) {
    let ffmc0 = 85.0; // standard baseline
    // Rain reduction
    let rf = rain > 0.5 ? Math.min(rain, 25) : 0;
    let rainDamp = rf > 0 ? (1.5 * Math.log(1 + rf) * 12) : 0;
    
    // Thermal & humidity drying
    let tempEffect = (temp - 20) * 0.45;
    let rhEffect = (50 - rh) * 0.42;
    let windEffect = (wind - 15) * 0.15;
    
    let ffmc = ffmc0 + tempEffect + rhEffect + windEffect - rainDamp;
    return Math.min(99.0, Math.max(10.0, ffmc));
  }

  /**
   * Approximate Initial Spread Index (ISI) from FFMC and Wind
   */
  static estimateISI(ffmc, wind) {
    let fm = 147.2 * (101.0 - ffmc) / (59.5 + ffmc); // Fuel moisture approx
    let fW = Math.exp(0.05039 * wind);
    let fF = 91.9 * Math.exp(-0.1386 * fm) * (1.0 + Math.pow(fm, 5.31) / (4.93e7));
    let isi = 0.208 * fW * fF;
    return Math.min(60.0, Math.max(0.1, isi));
  }

  /**
   * Comprehensive Fire Catch Probability & Sub-indices
   */
  static predictFromWeather({ temp, humidity, wind, rain, drought, forestType }) {
    const veg = VEGETATION_FACTORS[forestType] || VEGETATION_FACTORS.coniferous;
    const droughtVal = parseInt(drought, 10) || 3;

    // Derived FWI sub-indices
    const estFFMC = this.estimateFFMC(temp, humidity, wind, rain);
    const estISI = this.estimateISI(estFFMC, wind);
    
    // Duff Moisture Code (DMC) & Drought Code (DC) approximations
    const estDMC = Math.max(2, (temp * 0.8) + (droughtVal * 16) - (rain * 2.2));
    const estDC = Math.max(15, (droughtVal * 140) + (temp * 4.5) - (rain * 8.0));
    
    // Buildup Index (BUI)
    const estBUI = (estDMC * estDC) / (estDMC + 0.4 * estDC + 0.01);
    
    // Composite Fire Weather Index (FWI)
    let fwiB = estBUI > 80 ? (0.1 * estISI * (0.8 * estBUI / (estBUI + 50))) : (0.1 * estISI * (estBUI / 60));
    let estFWI = Math.max(0.1, estISI * 0.65 + fwiB * 2.4);

    // Fuel Moisture estimation (%)
    const fuelMoisture = Math.max(3.0, (147.2 * (101.0 - estFFMC) / (59.5 + estFFMC)) * 0.16 + (humidity * 0.08) + (rain * 0.35));

    // Multi-factor Logistic Ensemble Log-Odds (z)
    // Calibrated against UCI Forest Fire + Algerian Forest Fire empirical distributions
    let z = -4.50; // intercept
    z += 0.135 * (temp - 20);                  // Warmth drives ignition
    z += 0.075 * (55 - humidity);              // Dry air drives ignition
    z += 0.048 * (wind - 12);                  // Oxygen & ember carry
    z -= 0.380 * Math.min(rain * 1.8, 15);     // Precipitation suppression
    z += 0.520 * (droughtVal - 2.5);           // Deep dryness
    z *= veg.multiplier;                       // Vegetation flammability

    // Sigmoid probability function
    let prob = 1.0 / (1.0 + Math.exp(-z));
    
    // Clamp between realistic 1.2% and 99.1%
    prob = Math.min(0.991, Math.max(0.012, prob)) * 100;

    // Spread velocity estimate (meters/minute)
    let spreadVelocity = Math.max(0.5, (estISI * 1.45 * veg.spreadBase * (1 + (wind / 40))));

    // Factor percentage contributions for UI bar chart
    let tScore = Math.max(5, (temp / 50) * 100);
    let hScore = Math.max(5, ((100 - humidity) / 100) * 100);
    let wScore = Math.max(5, (wind / 80) * 100);
    let rScore = Math.min(100, (rain / 20) * 100);

    return {
      probability: Math.round(prob * 10) / 10,
      fwi: Math.round(estFWI * 10) / 10,
      isi: Math.round(estISI * 10) / 10,
      ffmc: Math.round(estFFMC * 10) / 10,
      dmc: Math.round(estDMC * 10) / 10,
      dc: Math.round(estDC * 10) / 10,
      fuelMoisture: Math.round(fuelMoisture * 10) / 10,
      spreadVelocity: Math.round(spreadVelocity),
      threat: this.classifyThreat(prob),
      factors: {
        temp: Math.round(tScore),
        humidity: Math.round(hScore),
        wind: Math.round(wScore),
        rain: Math.round(rScore)
      }
    };
  }

  /**
   * Prediction directly from standard FWI indices (Advanced Mode)
   */
  static predictFromFWI({ ffmc, dmc, dc, isi, forestType }) {
    const veg = VEGETATION_FACTORS[forestType] || VEGETATION_FACTORS.coniferous;

    // Compute BUI & FWI
    let bui = (0.8 * dmc * dc) / (dmc + 0.4 * dc + 0.001);
    let fwi = Math.max(0.1, 0.1 * isi * (0.8 + bui / 50));

    // Logistic probability based on FWI components
    let z = -5.0;
    z += 0.12 * (ffmc - 75);
    z += 0.02 * (dmc - 20);
    z += 0.005 * (dc - 200);
    z += 0.18 * (isi - 5);
    z *= veg.multiplier;

    let prob = 1.0 / (1.0 + Math.exp(-z));
    prob = Math.min(0.991, Math.max(0.012, prob)) * 100;

    let fuelMoisture = Math.max(3.0, (147.2 * (101.0 - ffmc) / (59.5 + ffmc)) * 0.18);
    let spreadVelocity = Math.max(0.5, (isi * 1.5 * veg.spreadBase));

    return {
      probability: Math.round(prob * 10) / 10,
      fwi: Math.round(fwi * 10) / 10,
      isi: Math.round(isi * 10) / 10,
      ffmc: Math.round(ffmc * 10) / 10,
      dmc: Math.round(dmc * 10) / 10,
      dc: Math.round(dc * 10) / 10,
      fuelMoisture: Math.round(fuelMoisture * 10) / 10,
      spreadVelocity: Math.round(spreadVelocity),
      threat: this.classifyThreat(prob),
      factors: {
        temp: Math.min(100, Math.round((ffmc / 100) * 90)),
        humidity: Math.min(100, Math.round((101 - ffmc) * 2.5)),
        wind: Math.min(100, Math.round(isi * 3)),
        rain: Math.max(0, Math.round(100 - ffmc))
      }
    };
  }

  /**
   * Determine categorical threat tier & UI attributes
   */
  static classifyThreat(prob) {
    if (prob < 25.0) {
      return {
        level: 'LOW',
        className: 'threat-low',
        color: '#10b981',
        title: 'LOW FIRE DANGER',
        summary: 'Moisture in vegetation suppresses ignition. Creeping surface fire possible only with direct flame contact. Readily contained by standard patrols.',
        icon: '🛡️',
        fwiText: 'Minimal Hazard',
        moistureText: 'High Moisture Content',
        advisories: [
          'Routine forest management activities and controlled burning permitted within safety guidelines.',
          'Maintain regular fire tower surveillance and weather station logging.',
          'Standard recreational campfires permitted in designated ring fire pits.',
          'Ensure fire access roads and water refilling hydrants remain unobstructed.'
        ]
      };
    } else if (prob < 50.0) {
      return {
        level: 'MODERATE',
        className: 'threat-moderate',
        color: '#f59e0b',
        title: 'MODERATE FIRE DANGER',
        summary: 'Surface fires will ignite from unattended campfires or sparks. Moderately active flame spread in open areas. Ground crews can control with hand tools.',
        icon: '⚠️',
        fwiText: 'Moderate Risk',
        moistureText: 'Medium Fuel Moisture',
        advisories: [
          'Restrict agricultural burning to early morning hours before thermal peak.',
          'Issue campfire warnings at public park trailheads and recreation sites.',
          'Ground patrol units placed on standby with portable water pump apparatus.',
          'Inspect spark arrestors on chainsaws, timber harvesters, and off-road vehicles.'
        ]
      };
    } else if (prob < 75.0) {
      return {
        level: 'HIGH',
        className: 'threat-high',
        color: '#ff7528',
        title: 'HIGH FIRE DANGER',
        summary: 'Fine fuels ignite readily from any spark, match, or exhaust heat. Vigorous surface fires with occasional single tree torching. Fire suppression is challenging.',
        icon: '🔥',
        fwiText: 'High Spread Index',
        moistureText: 'Dry & Vulnerable',
        advisories: [
          'Strict campfire and debris burning ban in effect across all forest parcels.',
          'Halt industrial forestry operations during peak afternoon dry hours (12 PM - 5 PM).',
          'Pre-position initial attack strike teams and bulldozer units at strategic trailheads.',
          'Activate aerial spotter flights or drone sweeps over vulnerable leeward slopes.'
        ]
      };
    } else {
      return {
        level: 'EXTREME',
        className: 'threat-extreme',
        color: '#ff334b',
        title: 'EXTREME / CRITICAL DANGER',
        summary: 'Explosive ignition potential. Fires will crown and exhibit rapid rate of spread with long-range spotting. Direct control at flame front is virtually impossible without heavy air tankers.',
        icon: '🚨',
        fwiText: 'Critical Crown Fire Risk',
        moistureText: 'Critically Desiccated',
        advisories: [
          'Total Fire Ban: Absolute prohibition of any outdoor open flame or hot-work cutting.',
          'Immediate closure of high-risk backcountry trails and public camping zones.',
          'Full mobilization of aerial fire tankers and wildland-urban interface (WUI) protection units.',
          'Issue pre-evacuation alert status to vulnerable adjacent communities and wildlife reserves.'
        ]
      };
    }
  }
}

// ============================================================================
// 3. UI CONTROLLER & EVENT LISTENERS
// ============================================================================

class PyroWatchApp {
  constructor() {
    this.currentMode = 'intuitive'; // 'intuitive' | 'advanced'
    this.historyList = this.loadHistory();
    this.currentResults = null;
    this.batchData = [];
    this.currentTheme = this.loadTheme();

    this.cacheDom();
    this.applyTheme(this.currentTheme);
    this.bindEvents();
    this.syncAllInputs();
    this.runPrediction();
    this.renderHistoryTable();
  }

  cacheDom() {
    // Theme Toggle
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.themeLabel = document.getElementById('themeLabel');

    // Mode Switch
    this.modeIntuitiveBtn = document.getElementById('modeIntuitiveBtn');
    this.modeAdvancedBtn = document.getElementById('modeAdvancedBtn');
    this.intuitiveFields = document.getElementById('intuitiveFields');
    this.advancedFields = document.getElementById('advancedFields');

    // Weather Inputs & Sliders
    this.forestTypeSelect = document.getElementById('forestType');
    this.forestTypeHint = document.getElementById('forestTypeHint');
    this.tempSlider = document.getElementById('tempSlider');
    this.tempInput = document.getElementById('tempInput');
    this.tempBadge = document.getElementById('tempBadge');

    this.humiditySlider = document.getElementById('humiditySlider');
    this.humidityInput = document.getElementById('humidityInput');
    this.humidityBadge = document.getElementById('humidityBadge');

    this.windSlider = document.getElementById('windSlider');
    this.windInput = document.getElementById('windInput');
    this.windBadge = document.getElementById('windBadge');

    this.rainSlider = document.getElementById('rainSlider');
    this.rainInput = document.getElementById('rainInput');
    this.rainBadge = document.getElementById('rainBadge');

    this.droughtSlider = document.getElementById('droughtSlider');
    this.droughtBadge = document.getElementById('droughtBadge');

    // Advanced Inputs
    this.ffmcSlider = document.getElementById('ffmcSlider');
    this.ffmcInput = document.getElementById('ffmcInput');
    this.ffmcBadge = document.getElementById('ffmcBadge');

    this.dmcSlider = document.getElementById('dmcSlider');
    this.dmcInput = document.getElementById('dmcInput');
    this.dmcBadge = document.getElementById('dmcBadge');

    this.dcSlider = document.getElementById('dcSlider');
    this.dcInput = document.getElementById('dcInput');
    this.dcBadge = document.getElementById('dcBadge');

    this.isiSlider = document.getElementById('isiSlider');
    this.isiInput = document.getElementById('isiInput');
    this.isiBadge = document.getElementById('isiBadge');

    // Action buttons & Toggles
    this.computeBtn = document.getElementById('computeBtn');
    this.saveHistoryBtn = document.getElementById('saveHistoryBtn');
    this.realtimeToggle = document.getElementById('realtimeToggle');

    // Presets
    this.presetPills = document.querySelectorAll('.preset-pill');

    // Results Display Elements
    this.probValueDisplay = document.getElementById('probValueDisplay');
    this.gaugeProgressArc = document.getElementById('gaugeProgressArc');
    this.gaugeNeedleGroup = document.getElementById('gaugeNeedleGroup');
    this.threatLevelBadge = document.getElementById('threatLevelBadge');
    this.threatLevelText = document.getElementById('threatLevelText');
    this.threatSummaryText = document.getElementById('threatSummaryText');
    this.calcTimestamp = document.getElementById('calcTimestamp');

    // Metrics
    this.metricFwiVal = document.getElementById('metricFwiVal');
    this.metricFwiDesc = document.getElementById('metricFwiDesc');
    this.metricIsiVal = document.getElementById('metricIsiVal');
    this.metricMoistureVal = document.getElementById('metricMoistureVal');
    this.metricVelocityVal = document.getElementById('metricVelocityVal');

    // Factor Bars
    this.factorTempBar = document.getElementById('factorTempBar');
    this.factorTempText = document.getElementById('factorTempText');
    this.factorHumidityBar = document.getElementById('factorHumidityBar');
    this.factorHumidityText = document.getElementById('factorHumidityText');
    this.factorWindBar = document.getElementById('factorWindBar');
    this.factorWindText = document.getElementById('factorWindText');
    this.factorRainBar = document.getElementById('factorRainBar');
    this.factorRainText = document.getElementById('factorRainText');

    // Advisory
    this.advisoryIcon = document.getElementById('advisoryIcon');
    this.advisoryTitle = document.getElementById('advisoryTitle');
    this.advisoryList = document.getElementById('advisoryList');

    // History Table
    this.historyTableBody = document.getElementById('historyTableBody');
    this.emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
    this.exportHistoryBtn = document.getElementById('exportHistoryBtn');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // CSV Upload & Batch Modal
    this.csvDropZone = document.getElementById('csvDropZone');
    this.csvFileInput = document.getElementById('csvFileInput');
    this.csvFileStatus = document.getElementById('csvFileStatus');
    this.downloadSampleCsvBtn = document.getElementById('downloadSampleCsvBtn');
    this.batchResultsModal = document.getElementById('batchResultsModal');
    this.batchTableBody = document.getElementById('batchTableBody');
    this.batchSummaryStats = document.getElementById('batchSummaryStats');
    this.closeBatchModalBtn = document.getElementById('closeBatchModalBtn');
    this.dismissBatchModalBtn = document.getElementById('dismissBatchModalBtn');
    this.exportBatchCsvBtn = document.getElementById('exportBatchCsvBtn');
  }

  bindEvents() {
    // Mode Switch Tabs
    this.modeIntuitiveBtn.addEventListener('click', () => this.setMode('intuitive'));
    this.modeAdvancedBtn.addEventListener('click', () => this.setMode('advanced'));

    // Two-way bindings for slider & num-boxes
    this.bindSliderNumberPair(this.tempSlider, this.tempInput, (val) => {
      this.tempBadge.textContent = `${parseFloat(val).toFixed(1)} °C`;
    });

    this.bindSliderNumberPair(this.humiditySlider, this.humidityInput, (val) => {
      this.humidityBadge.textContent = `${parseInt(val, 10)} %`;
    });

    this.bindSliderNumberPair(this.windSlider, this.windInput, (val) => {
      this.windBadge.textContent = `${parseInt(val, 10)} km/h`;
    });

    this.bindSliderNumberPair(this.rainSlider, this.rainInput, (val) => {
      this.rainBadge.textContent = `${parseFloat(val).toFixed(1)} mm`;
    });

    this.droughtSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      this.droughtBadge.textContent = DROUGHT_LABELS[v] || `${v}`;
      this.onInputChange();
    });

    this.forestTypeSelect.addEventListener('change', (e) => {
      const veg = VEGETATION_FACTORS[e.target.value];
      if (veg) this.forestTypeHint.textContent = veg.hint;
      this.onInputChange();
    });

    // Advanced Sliders
    this.bindSliderNumberPair(this.ffmcSlider, this.ffmcInput, (val) => {
      this.ffmcBadge.textContent = parseFloat(val).toFixed(1);
    });

    this.bindSliderNumberPair(this.dmcSlider, this.dmcInput, (val) => {
      this.dmcBadge.textContent = parseFloat(val).toFixed(1);
    });

    this.bindSliderNumberPair(this.dcSlider, this.dcInput, (val) => {
      this.dcBadge.textContent = parseFloat(val).toFixed(1);
    });

    this.bindSliderNumberPair(this.isiSlider, this.isiInput, (val) => {
      this.isiBadge.textContent = parseFloat(val).toFixed(1);
    });

    // Action buttons
    this.computeBtn.addEventListener('click', () => {
      this.runPrediction();
      this.flashButton(this.computeBtn);
    });

    this.saveHistoryBtn.addEventListener('click', () => this.saveCurrentToHistory());

    // Presets
    const quickPresetTrigger = document.getElementById('quickPresetTrigger');
    if (quickPresetTrigger) {
      quickPresetTrigger.addEventListener('click', () => {
        const presetsBar = document.getElementById('presetsBar');
        if (presetsBar) {
          presetsBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    this.presetPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const presetKey = e.currentTarget.dataset.preset;
        this.applyPreset(presetKey);
      });
    });

    // History Actions
    this.exportHistoryBtn.addEventListener('click', () => this.exportHistoryCSV());
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

    // CSV Handlers
    this.downloadSampleCsvBtn.addEventListener('click', () => this.downloadSampleCSV());
    this.setupCsvDragAndDrop();

    // Theme Toggle Handler
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Batch Modal Handlers
    this.closeBatchModalBtn.addEventListener('click', () => this.closeBatchModal());
    this.dismissBatchModalBtn.addEventListener('click', () => this.closeBatchModal());
    this.exportBatchCsvBtn.addEventListener('click', () => this.exportBatchCSV());
  }

  // ============================================================================
  // FOREST THEME CONTROLLER
  // ============================================================================

  loadTheme() {
    const saved = localStorage.getItem('pyrowatch_theme');
    if (saved) return saved;
    // Default to dark forest theme
    return 'dark';
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('pyrowatch_theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (this.themeIcon) this.themeIcon.textContent = '🌙';
      if (this.themeLabel) this.themeLabel.textContent = 'Dark Forest';
      if (this.themeToggleBtn) this.themeToggleBtn.title = 'Switch to Dark Forest Mode';
    } else {
      document.body.classList.remove('light-theme');
      if (this.themeIcon) this.themeIcon.textContent = '☀️';
      if (this.themeLabel) this.themeLabel.textContent = 'Light Forest';
      if (this.themeToggleBtn) this.themeToggleBtn.title = 'Switch to Light Forest Mode';
    }
  }

  bindSliderNumberPair(slider, input, onUpdate) {
    slider.addEventListener('input', (e) => {
      input.value = e.target.value;
      if (onUpdate) onUpdate(e.target.value);
      this.onInputChange();
    });

    input.addEventListener('input', (e) => {
      slider.value = e.target.value;
      if (onUpdate) onUpdate(e.target.value);
      this.onInputChange();
    });
  }

  syncAllInputs() {
    this.tempBadge.textContent = `${parseFloat(this.tempSlider.value).toFixed(1)} °C`;
    this.humidityBadge.textContent = `${this.humiditySlider.value} %`;
    this.windBadge.textContent = `${this.windSlider.value} km/h`;
    this.rainBadge.textContent = `${parseFloat(this.rainSlider.value).toFixed(1)} mm`;
    this.droughtBadge.textContent = DROUGHT_LABELS[this.droughtSlider.value] || 'Parched';
  }

  setMode(mode) {
    this.currentMode = mode;
    if (mode === 'intuitive') {
      this.modeIntuitiveBtn.classList.add('active');
      this.modeIntuitiveBtn.setAttribute('aria-checked', 'true');
      this.modeAdvancedBtn.classList.remove('active');
      this.modeAdvancedBtn.setAttribute('aria-checked', 'false');

      this.intuitiveFields.classList.remove('hidden');
      this.advancedFields.classList.add('hidden');
    } else {
      this.modeAdvancedBtn.classList.add('active');
      this.modeAdvancedBtn.setAttribute('aria-checked', 'true');
      this.modeIntuitiveBtn.classList.remove('active');
      this.modeIntuitiveBtn.setAttribute('aria-checked', 'false');

      this.intuitiveFields.classList.add('hidden');
      this.advancedFields.classList.remove('hidden');
    }
    this.runPrediction();
  }

  onInputChange() {
    if (this.realtimeToggle.checked) {
      this.runPrediction();
    }
  }

  applyPreset(presetKey) {
    const p = SCENARIO_PRESETS[presetKey];
    if (!p) return;

    this.presetPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.preset === presetKey);
    });

    // Intuitive values
    this.tempSlider.value = p.temp;
    this.tempInput.value = p.temp;
    this.tempBadge.textContent = `${p.temp} °C`;

    this.humiditySlider.value = p.humidity;
    this.humidityInput.value = p.humidity;
    this.humidityBadge.textContent = `${p.humidity} %`;

    this.windSlider.value = p.wind;
    this.windInput.value = p.wind;
    this.windBadge.textContent = `${p.wind} km/h`;

    this.rainSlider.value = p.rain;
    this.rainInput.value = p.rain;
    this.rainBadge.textContent = `${p.rain} mm`;

    this.droughtSlider.value = p.drought;
    this.droughtBadge.textContent = DROUGHT_LABELS[p.drought];

    if (p.forestType) {
      this.forestTypeSelect.value = p.forestType;
      this.forestTypeHint.textContent = VEGETATION_FACTORS[p.forestType].hint;
    }

    // Advanced values
    this.ffmcSlider.value = p.ffmc;
    this.ffmcInput.value = p.ffmc;
    this.ffmcBadge.textContent = p.ffmc;

    this.dmcSlider.value = p.dmc;
    this.dmcInput.value = p.dmc;
    this.dmcBadge.textContent = p.dmc;

    this.dcSlider.value = p.dc;
    this.dcInput.value = p.dc;
    this.dcBadge.textContent = p.dc;

    this.isiSlider.value = p.isi;
    this.isiInput.value = p.isi;
    this.isiBadge.textContent = p.isi;

    this.runPrediction();
  }

  flashButton(btn) {
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => btn.style.transform = '', 150);
  }

  // ============================================================================
  // PREDICTION EXECUTION & UI UPDATE
  // ============================================================================

  runPrediction() {
    let result;
    if (this.currentMode === 'intuitive') {
      result = ForestFirePredictor.predictFromWeather({
        temp: parseFloat(this.tempSlider.value),
        humidity: parseFloat(this.humiditySlider.value),
        wind: parseFloat(this.windSlider.value),
        rain: parseFloat(this.rainSlider.value),
        drought: parseInt(this.droughtSlider.value, 10),
        forestType: this.forestTypeSelect.value
      });

      // Keep advanced inputs loosely synchronized
      this.ffmcSlider.value = result.ffmc;
      this.ffmcInput.value = result.ffmc;
      this.ffmcBadge.textContent = result.ffmc;

      this.dmcSlider.value = result.dmc;
      this.dmcInput.value = result.dmc;
      this.dmcBadge.textContent = result.dmc;

      this.dcSlider.value = result.dc;
      this.dcInput.value = result.dc;
      this.dcBadge.textContent = result.dc;

      this.isiSlider.value = result.isi;
      this.isiInput.value = result.isi;
      this.isiBadge.textContent = result.isi;
    } else {
      result = ForestFirePredictor.predictFromFWI({
        ffmc: parseFloat(this.ffmcSlider.value),
        dmc: parseFloat(this.dmcSlider.value),
        dc: parseFloat(this.dcSlider.value),
        isi: parseFloat(this.isiSlider.value),
        forestType: this.forestTypeSelect.value
      });
    }

    this.currentResults = result;
    this.renderResults(result);
  }

  renderResults(res) {
    // 1. Digital Readout
    this.probValueDisplay.textContent = res.probability.toFixed(1);

    // 2. Animated SVG Gauge Needle & Arc
    // Arc radius = 108. Arc length = pi * 108 = 339.29
    const maxOffset = 339.3;
    const currentOffset = maxOffset - (res.probability / 100) * maxOffset;
    this.gaugeProgressArc.style.strokeDashoffset = currentOffset;
    this.gaugeProgressArc.style.stroke = res.threat.color;

    // Needle Angle: from -90 deg (0%) to +90 deg (100%)
    const needleAngle = -90 + (res.probability / 100) * 180;
    this.gaugeNeedleGroup.setAttribute('transform', `translate(140, 140) rotate(${needleAngle})`);

    const needleCenter = document.getElementById('gaugeNeedleCenter');
    if (needleCenter) {
      needleCenter.style.fill = res.threat.color;
    }

    // 3. Danger Level Badge
    this.threatLevelBadge.className = `threat-badge ${res.threat.className}`;
    this.threatLevelText.textContent = res.threat.title;
    this.threatSummaryText.textContent = res.threat.summary;

    // 4. Metrics Grid
    this.metricFwiVal.textContent = res.fwi.toFixed(1);
    this.metricFwiDesc.textContent = res.threat.fwiText;
    this.metricIsiVal.textContent = res.isi.toFixed(1);
    this.metricMoistureVal.textContent = `${res.fuelMoisture.toFixed(1)}%`;
    this.metricVelocityVal.textContent = `${res.spreadVelocity} m/min`;

    // 5. Critical Factor Bars
    this.factorTempBar.style.width = `${res.factors.temp}%`;
    this.factorTempText.textContent = `${res.factors.temp}% Heat Impact`;

    this.factorHumidityBar.style.width = `${res.factors.humidity}%`;
    this.factorHumidityText.textContent = `${res.factors.humidity}% Aridity Impact`;

    this.factorWindBar.style.width = `${res.factors.wind}%`;
    this.factorWindText.textContent = `${res.factors.wind}% Wind Convection`;

    this.factorRainBar.style.width = `${res.factors.rain}%`;
    this.factorRainText.textContent = `${res.factors.rain}% Rain Dampening`;

    // 6. Actionable Advisory
    this.advisoryIcon.textContent = res.threat.icon;
    this.advisoryTitle.textContent = `${res.threat.level} Level Actionable Advisory`;
    this.advisoryList.innerHTML = res.threat.advisories
      .map(item => `<li>${item}</li>`)
      .join('');

    // 7. Timestamp
    const now = new Date();
    this.calcTimestamp.textContent = `Updated: ${now.toLocaleTimeString()}`;
  }

  // ============================================================================
  // HISTORY LOGGING
  // ============================================================================

  loadHistory() {
    try {
      const raw = localStorage.getItem('pyrowatch_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveHistoryToStorage() {
    try {
      localStorage.setItem('pyrowatch_history', JSON.stringify(this.historyList));
    } catch (e) {
      console.warn('Storage quota exceeded', e);
    }
  }

  saveCurrentToHistory() {
    if (!this.currentResults) return;

    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      vegetation: VEGETATION_FACTORS[this.forestTypeSelect.value].name,
      temp: parseFloat(this.tempSlider.value),
      humidity: parseInt(this.humiditySlider.value, 10),
      wind: parseInt(this.windSlider.value, 10),
      rain: parseFloat(this.rainSlider.value),
      drought: this.droughtSlider.value,
      probability: this.currentResults.probability,
      threat: this.currentResults.threat.level,
      threatColor: this.currentResults.threat.color
    };

    this.historyList.unshift(entry);
    if (this.historyList.length > 50) this.historyList.pop();

    this.saveHistoryToStorage();
    this.renderHistoryTable();
    this.flashButton(this.saveHistoryBtn);
  }

  renderHistoryTable() {
    if (this.historyList.length === 0) {
      this.emptyHistoryMsg.style.display = 'block';
      this.historyTableBody.innerHTML = '';
      return;
    }

    this.emptyHistoryMsg.style.display = 'none';
    this.historyTableBody.innerHTML = this.historyList.map(item => `
      <tr>
        <td>${item.timestamp}</td>
        <td>${item.vegetation}</td>
        <td>${item.temp}°C</td>
        <td>${item.humidity}%</td>
        <td>${item.wind} km/h</td>
        <td>${item.rain} mm</td>
        <td>Lvl ${item.drought}</td>
        <td><strong style="color: ${item.threatColor}">${item.probability.toFixed(1)}%</strong></td>
        <td><span class="cell-pill" style="background: ${item.threatColor}22; color: ${item.threatColor}; border: 1px solid ${item.threatColor}55;">${item.threat}</span></td>
        <td><button class="btn-link" onclick="window.app.deleteHistoryItem(${item.id})">Delete</button></td>
      </tr>
    `).join('');
  }

  deleteHistoryItem(id) {
    this.historyList = this.historyList.filter(item => item.id !== id);
    this.saveHistoryToStorage();
    this.renderHistoryTable();
  }

  clearHistory() {
    if (confirm('Clear all logged evaluations?')) {
      this.historyList = [];
      this.saveHistoryToStorage();
      this.renderHistoryTable();
    }
  }

  exportHistoryCSV() {
    if (this.historyList.length === 0) {
      alert('History is empty. Record some evaluations first!');
      return;
    }

    const headers = ['Timestamp', 'Vegetation', 'Temperature_C', 'Humidity_pct', 'Wind_kmh', 'Rain_mm', 'Drought_Level', 'Fire_Probability_pct', 'Threat_Level'];
    const rows = this.historyList.map(h => [
      h.timestamp,
      `"${h.vegetation}"`,
      h.temp,
      h.humidity,
      h.wind,
      h.rain,
      h.drought,
      h.probability,
      h.threat
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.triggerDownload(csvContent, 'pyrowatch_evaluation_history.csv', 'text/csv');
  }

  // ============================================================================
  // CSV BULK PROCESSING & DOWNLOADS
  // ============================================================================

  downloadSampleCSV() {
    const sampleRows = [
      'forest_type,temp,humidity,wind,rain,drought',
      'coniferous,41.2,15,36,0.0,5',
      'shrubland,33.5,24,48,0.0,4',
      'mixed,27.0,46,18,0.5,3',
      'deciduous,18.0,85,12,14.0,1',
      'coniferous,37.5,18,22,0.0,5',
      'grassland,32.0,28,42,0.0,4',
      'mixed,22.0,62,14,2.5,2',
      'coniferous,29.0,38,20,0.0,3'
    ].join('\n');

    this.triggerDownload(sampleRows, 'sample_forest_fire_data.csv', 'text/csv');
  }

  setupCsvDragAndDrop() {
    const zone = this.csvDropZone;
    const input = this.csvFileInput;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.processCsvFile(e.dataTransfer.files[0]);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.processCsvFile(e.target.files[0]);
      }
    });
  }

  processCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a valid .csv file.');
      return;
    }

    this.csvFileStatus.textContent = `Processing ${file.name}...`;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        this.parseAndEvaluateBatchCSV(text, file.name);
      } catch (err) {
        alert('Failed to parse CSV file: ' + err.message);
        this.csvFileStatus.textContent = 'Error parsing CSV';
      }
    };
    reader.readAsText(file);
  }

  parseAndEvaluateBatchCSV(csvText, filename) {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      alert('CSV must contain a header row and at least one data row.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Header mappings
    const getIndex = (aliases) => headers.findIndex(h => aliases.some(a => h.includes(a)));
    const tempIdx = getIndex(['temp', 'temperature']);
    const rhIdx = getIndex(['humidity', 'rh']);
    const windIdx = getIndex(['wind', 'ws']);
    const rainIdx = getIndex(['rain', 'precip']);
    const droughtIdx = getIndex(['drought', 'dryness', 'dc']);
    const typeIdx = getIndex(['type', 'forest', 'veg']);

    if (tempIdx === -1 || rhIdx === -1) {
      alert('CSV must at least contain "temp" and "humidity" columns.');
      return;
    }

    this.batchData = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 2) continue;

      const temp = parseFloat(cols[tempIdx]) || 25.0;
      const humidity = parseFloat(cols[rhIdx]) || 50.0;
      const wind = windIdx !== -1 ? (parseFloat(cols[windIdx]) || 15.0) : 15.0;
      const rain = rainIdx !== -1 ? (parseFloat(cols[rainIdx]) || 0.0) : 0.0;
      const drought = droughtIdx !== -1 ? (parseInt(cols[droughtIdx], 10) || 3) : 3;
      const forestType = typeIdx !== -1 ? (cols[typeIdx] || 'coniferous') : 'coniferous';

      const prediction = ForestFirePredictor.predictFromWeather({
        temp, humidity, wind, rain, drought, forestType
      });

      // Primary Hazard Identification
      let hazard = 'Normal';
      if (temp > 35 && humidity < 25) hazard = 'High Heat & Low Humidity';
      else if (wind > 40) hazard = 'Extreme Wind Convection';
      else if (drought >= 4) hazard = 'Deep Soil Drought';
      else if (rain > 10) hazard = 'Rain Dampening';

      this.batchData.push({
        row: i,
        forestType,
        temp,
        humidity,
        wind,
        rain,
        drought,
        probability: prediction.probability,
        threat: prediction.threat.level,
        threatColor: prediction.threat.color,
        hazard
      });
    }

    this.csvFileStatus.textContent = `Loaded ${this.batchData.length} rows from ${filename}`;
    this.displayBatchModal();
  }

  displayBatchModal() {
    const highRiskCount = this.batchData.filter(d => d.probability >= 50).length;
    this.batchSummaryStats.textContent = `Analyzed ${this.batchData.length} forest parcels: ${highRiskCount} classified as HIGH / EXTREME danger.`;

    this.batchTableBody.innerHTML = this.batchData.map(d => `
      <tr class="${d.probability >= 75 ? 'high-risk' : ''}">
        <td>#${d.row}</td>
        <td>${d.forestType}</td>
        <td>${d.temp}°C</td>
        <td>${d.humidity}%</td>
        <td>${d.wind} km/h</td>
        <td>${d.rain} mm</td>
        <td><strong style="color: ${d.threatColor}">${d.probability.toFixed(1)}%</strong></td>
        <td><span class="cell-pill" style="background: ${d.threatColor}22; color: ${d.threatColor}; border: 1px solid ${d.threatColor}55;">${d.threat}</span></td>
        <td>${d.hazard}</td>
      </tr>
    `).join('');

    this.batchResultsModal.classList.remove('hidden');
  }

  closeBatchModal() {
    this.batchResultsModal.classList.add('hidden');
  }

  exportBatchCSV() {
    if (this.batchData.length === 0) return;

    const headers = ['Row', 'Forest_Type', 'Temperature_C', 'Humidity_pct', 'Wind_kmh', 'Rain_mm', 'Drought_Level', 'Fire_Probability_pct', 'Threat_Level', 'Primary_Hazard'];
    const rows = this.batchData.map(d => [
      d.row,
      `"${d.forestType}"`,
      d.temp,
      d.humidity,
      d.wind,
      d.rain,
      d.drought,
      d.probability,
      d.threat,
      `"${d.hazard}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.triggerDownload(csvContent, 'evaluated_forest_fire_probabilities.csv', 'text/csv');
  }

  triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.app = new PyroWatchApp();
});

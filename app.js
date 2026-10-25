/**
 * Sliva Save - Forest Fire Prevention System
 * Incorporates Canadian Forest Fire Weather Index (FWI) principles and
 * illustrative relative-risk scoring and Canadian FWI calculations.
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
    forestType: 'coniferous',
    ffmc: 94.2,
    dmc: 72.0,
    dc: 540.0,
    isi: 22.5
  },
  'arid-windy': {
    name: 'Hot & Dry Conditions',
    temp: 34.0,
    humidity: 22,
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
    forestType: 'mixed',
    ffmc: 84.0,
    dmc: 28.0,
    dc: 220.0,
    isi: 6.2
  },
  rainy: {
    name: 'Cool & Humid Conditions',
    temp: 17.5,
    humidity: 86,
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
    forestType: 'coniferous',
    ffmc: 93.0,
    dmc: 88.0,
    dc: 680.0,
    isi: 15.4
  }
};

// ============================================================================
// 2. SCIENTIFIC COMPUTATION & ML PREDICTION ENGINE
// ============================================================================

class ForestFirePredictor {

  /**
  * Illustrative relative score from limited weather inputs.
   */
  static predictFromWeather({ temp, humidity, forestType }) {
    const veg = VEGETATION_FACTORS[forestType] || VEGETATION_FACTORS.coniferous;
    // This score is illustrative, not a calibrated ignition probability.
    let z = -4.50; // intercept
    z += 0.135 * (temp - 20);                  // Warmth drives ignition
    z += 0.075 * (55 - humidity);              // Dry air drives ignition
    z *= veg.multiplier;                       // Vegetation flammability

    const riskScore = Math.round((1 / (1 + Math.exp(-z))) * 1000) / 10;

    // Factor percentage contributions for UI bar chart
    let tScore = Math.max(5, (temp / 50) * 100);
    let hScore = Math.max(5, ((100 - humidity) / 100) * 100);
    return {
      riskScore,
      fwi: null,
      isi: null,
      ffmc: null,
      dmc: null,
      dc: null,
      fuelMoisture: null,
      spreadVelocity: null,
      threat: this.classifyThreat(riskScore),
      factors: {
        temp: Math.round(tScore),
        humidity: Math.round(hScore)
      }
    };
  }

  /**
   * Prediction directly from standard FWI indices (Advanced Mode)
   */
  static predictFromFWI({ ffmc, dmc, dc, isi, forestType }) {
    const veg = VEGETATION_FACTORS[forestType] || VEGETATION_FACTORS.coniferous;

    const bui = this.calculateBUI(dmc, dc);
    const fwi = this.calculateFWI(isi, bui);

    // An uncalibrated score, retained only for the qualitative display bands.
    let z = -5.0;
    z += 0.12 * (ffmc - 75);
    z += 0.02 * (dmc - 20);
    z += 0.005 * (dc - 200);
    z += 0.18 * (isi - 5);
    z *= veg.multiplier;

    const riskScore = Math.round((1 / (1 + Math.exp(-z))) * 1000) / 10;

    return {
      riskScore,
      fwi: Math.round(fwi * 10) / 10,
      isi: Math.round(isi * 10) / 10,
      ffmc: Math.round(ffmc * 10) / 10,
      dmc: Math.round(dmc * 10) / 10,
      dc: Math.round(dc * 10) / 10,
      fuelMoisture: null,
      spreadVelocity: null,
      threat: this.classifyThreat(riskScore),
      factors: {
        temp: Math.min(100, Math.round((ffmc / 100) * 90)),
        humidity: Math.min(100, Math.round((101 - ffmc) * 2.5))
      }
    };
  }

  static calculateBUI(dmc, dc) {
    if (dmc <= 0.4 * dc) {
      return (0.8 * dmc * dc) / (dmc + 0.4 * dc);
    }
    return dmc - (1 - (0.8 * dc) / (dmc + 0.4 * dc)) * (0.92 + Math.pow(0.0114 * dmc, 1.7));
  }

  static calculateFWI(isi, bui) {
    const fD = bui <= 80
      ? 0.626 * Math.pow(bui, 0.809) + 2
      : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
    const b = 0.1 * isi * fD;
    if (b <= 1) return b;
    return Math.exp(2.72 * Math.pow(0.434 * Math.log(b), 0.647));
  }

  /** These score bands are illustrative and are not official danger classes. */
  static classifyThreat(score) {
    if (score < 25) {
      return { level: 'LOW SCORE', className: 'threat-low', color: '#10b981', title: 'LOW RELATIVE SCORE', icon: 'ℹ️' };
    }
    if (score < 50) {
      return { level: 'MODERATE SCORE', className: 'threat-moderate', color: '#f59e0b', title: 'MODERATE RELATIVE SCORE', icon: 'ℹ️' };
    }
    if (score < 75) {
      return { level: 'HIGH SCORE', className: 'threat-high', color: '#ff7528', title: 'HIGH RELATIVE SCORE', icon: 'ℹ️' };
    }
    return { level: 'VERY HIGH SCORE', className: 'threat-extreme', color: '#ff334b', title: 'VERY HIGH RELATIVE SCORE', icon: 'ℹ️' };
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
    this.probValueDisplay.textContent = res.riskScore.toFixed(1);

    // 2. Animated SVG Gauge Needle & Arc
    // Arc radius = 108. Arc length = pi * 108 = 339.29
    const maxOffset = 339.3;
    const currentOffset = maxOffset - (res.riskScore / 100) * maxOffset;
    this.gaugeProgressArc.style.strokeDashoffset = currentOffset;
    this.gaugeProgressArc.style.stroke = res.threat.color;

    // Needle angle: from -90 (0 points) to +90 (100 points).
    const needleAngle = -90 + (res.riskScore / 100) * 180;
    this.gaugeNeedleGroup.setAttribute('transform', `translate(140, 140) rotate(${needleAngle})`);

    const needleCenter = document.getElementById('gaugeNeedleCenter');
    if (needleCenter) {
      needleCenter.style.fill = res.threat.color;
    }

    // 3. Danger Level Badge
    this.threatLevelBadge.className = `threat-badge ${res.threat.className}`;
    this.threatLevelText.textContent = res.threat.title;
    this.threatSummaryText.textContent = `${res.threat.level} app-defined band. This is an illustrative score, not a calibrated probability or operational fire forecast.`;

    // 4. Metrics Grid
    this.metricFwiVal.textContent = res.fwi === null ? 'N/A' : res.fwi.toFixed(1);
    this.metricFwiDesc.textContent = res.fwi === null ? 'Requires valid FWI inputs' : 'Calculated from entered FWI codes';
    this.metricIsiVal.textContent = res.isi === null ? 'N/A' : res.isi.toFixed(1);
    this.metricMoistureVal.textContent = res.fuelMoisture === null ? 'N/A' : `${res.fuelMoisture.toFixed(1)}%`;
    this.metricVelocityVal.textContent = res.spreadVelocity === null ? 'N/A' : 'Not calculated';

    // 5. Critical Factor Bars
    this.factorTempBar.style.width = `${res.factors.temp}%`;
    this.factorTempText.textContent = `Temperature input indicator: ${res.factors.temp}/100`;

    this.factorHumidityBar.style.width = `${res.factors.humidity}%`;
    this.factorHumidityText.textContent = `Humidity input indicator: ${res.factors.humidity}/100`;

    // 6. Actionable Advisory
    this.advisoryIcon.textContent = res.threat.icon;
    this.advisoryIcon.textContent = 'ℹ️';
    this.advisoryTitle.textContent = 'How to interpret this result';
    this.advisoryList.innerHTML = [
      '<li>The 0–100 score is illustrative and has not been calibrated against observed fire events.</li>',
      '<li>For real-world conditions, consult the relevant fire authority and validated local fire-danger information.</li>'
    ].join('');

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
      riskScore: this.currentResults.riskScore,
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
        <td><strong style="color: ${item.threatColor}">${item.riskScore == null ? 'Legacy value—not comparable' : item.riskScore.toFixed(1)}</strong></td>
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

    const headers = ['Timestamp', 'Vegetation', 'Temperature_C', 'Humidity_pct', 'Illustrative_Risk_Score_0_to_100', 'Threat_Level'];
    const rows = this.historyList.map(h => [
      h.timestamp,
      `"${h.vegetation}"`,
      h.temp,
      h.humidity,
      h.riskScore ?? 'Legacy value—not comparable',
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
      'forest_type,temp,humidity',
      'coniferous,41.2,15',
      'shrubland,33.5,24',
      'mixed,27.0,46',
      'deciduous,18.0,85',
      'coniferous,37.5,18',
      'grassland,32.0,28',
      'mixed,22.0,62',
      'coniferous,29.0,38'
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
      const forestType = typeIdx !== -1 ? (cols[typeIdx] || 'coniferous') : 'coniferous';

      const prediction = ForestFirePredictor.predictFromWeather({
        temp, humidity, forestType
      });

      // Primary Hazard Identification
      let hazard = 'Normal';
      if (temp > 35 && humidity < 25) hazard = 'High Heat & Low Humidity';
      else if (humidity < 30) hazard = 'Low Humidity';

      this.batchData.push({
        row: i,
        forestType,
        temp,
        humidity,
        riskScore: prediction.riskScore,
        threat: prediction.threat.level,
        threatColor: prediction.threat.color,
        hazard
      });
    }

    this.csvFileStatus.textContent = `Loaded ${this.batchData.length} rows from ${filename}`;
    this.displayBatchModal();
  }

  displayBatchModal() {
    this.batchSummaryStats.textContent = `Analyzed ${this.batchData.length} records. Scores are illustrative, not calibrated probabilities.`;

    this.batchTableBody.innerHTML = this.batchData.map(d => `
      <tr class="${d.riskScore >= 75 ? 'high-risk' : ''}">
        <td>#${d.row}</td>
        <td>${d.forestType}</td>
        <td>${d.temp}°C</td>
        <td>${d.humidity}%</td>
        <td><strong style="color: ${d.threatColor}">${d.riskScore.toFixed(1)}</strong></td>
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

    const headers = ['Row', 'Forest_Type', 'Temperature_C', 'Humidity_pct', 'Illustrative_Risk_Score_0_to_100', 'Threat_Level', 'Primary_Hazard'];
    const rows = this.batchData.map(d => [
      d.row,
      `"${d.forestType}"`,
      d.temp,
      d.humidity,
      d.riskScore,
      d.threat,
      `"${d.hazard}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    this.triggerDownload(csvContent, 'evaluated_forest_fire_risk_scores.csv', 'text/csv');
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

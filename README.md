# 🔥 Sliva Save - Forest Fire Prevention System

An interactive educational demo. Weather Mode shows an unvalidated relative score from temperature, humidity, and vegetation; Advanced Mode calculates the standard Buildup Index (BUI) and Fire Weather Index (FWI) from user-supplied FWI codes. It does not predict calibrated fire probabilities.

---

## 🌟 Key Features

1. **🌲 Forest Themes & Mode Switcher**:
   - **Dark Forest Mode (Night Canopy)**: Deep evergreen obsidian background with ambient pine emerald and glowing ember lighting.
   - **Light Forest Mode (Daylight Woodland)**: Fresh misty sage green aesthetic with crisp frosted porcelain cards, dark pine typography, and high-contrast threat indicators.
   - 1-click theme toggle in the header with persistent memory via `localStorage`.

2. **Dual Input Systems**:
   - **🌤️ Weather Mode (Intuitive)**: Temperature (°C), Relative Humidity (%), and Forest Canopy Type (Coniferous, Deciduous, Mixed, Chaparral, Grassland).
   - **📐 Canadian FWI Advanced Mode**: Fine Fuel Moisture Code (FFMC), Duff Moisture Code (DMC), Drought Code (DC), and Initial Spread Index (ISI).

2. **Real-Time Illustrative Scoring**:
   - Animated 0–100 gauge for a heuristic, uncalibrated score (not a probability).
   - App-defined qualitative score bands; these are not official danger classes.
   - Advanced Mode calculates BUI and FWI from supplied FFMC, DMC, DC, and ISI values.
   - Weather Mode does not fabricate FWI, fuel moisture, or spread-rate outputs when necessary inputs are missing.

3. **Scenario Presets**:
   - One-click example conditions: *Extreme Heatwave*, *Hot & Dry Conditions*, *Typical Summer Forest*, *Cool & Humid Conditions*, and *Hot, Dry Forest*.

4. **Interpretation Notice**:
   - Advises users to consult relevant fire authorities and validated local fire-danger information for real-world decisions.

5. **Bulk CSV Evaluation**:
   - Drag & drop or upload a CSV to calculate illustrative scores for multiple records.
   - Preview evaluated rows and export the scores.
   - Pre-bundled with `sample_forest_data.csv`.

6. **Persistent History Log**:
   - Save custom scenarios to a session history log with timestamp, inputs, and danger tier.
   - Export evaluation history to CSV.

---

## 🚀 How to Run Locally

### Option 1: Direct in Browser
Simply double-click [`index.html`](file:///c:/Users/bhask/OneDrive/Desktop/Forest%20P/index.html) in your file explorer to open it in Google Chrome, Microsoft Edge, or any modern web browser.

### Option 2: Local HTTP Server (Recommended)
You can run a local server using Python or Node.js:

```powershell
# Using Python:
python -m http.server 3000

# Using Node (npx):
npx serve .
```
Then visit: `http://localhost:3000`

---

## Calculation scope and limitations

Weather Mode calculates a **heuristic 0–100 score**, not a fire probability. Its coefficients and vegetation multipliers are not calibrated or validated against observed fire events. Since wind, rainfall, prior-day codes, and seasonal inputs are not collected in this mode, it does not calculate FWI metrics.

Advanced Mode computes BUI and FWI from supplied FFMC, DMC, DC, and ISI using the standard piecewise transformations. The accuracy of those outputs depends on the supplied codes being valid and consistently calculated. The app does not generate daily FFMC, DMC, or DC from weather history.

Score bands are app-defined and not official danger thresholds. This educational application is not an operational forecast and must not be used for fire-management or public-safety decisions. Consult validated local sources and authorities.

Weather Mode uses canopy multipliers as heuristic score weights:
- **Chaparral / Shrubland**: 1.25x
- **Coniferous / Pine**: 1.18x
- **Grassland**: 1.15x
- **Mixed Canopy**: 1.00x
- **Deciduous Hardwood**: 0.85x

---

*Educational demonstration only.*

# 🔥 PyroWatch AI - Forest Fire Probability & Wildfire Risk Assessment

An advanced, interactive web application designed to compute and display the **probability of catching fire in a forest** based on environmental weather conditions or Canadian Forest Fire Weather Index (FWI) parameters.

---

## 🌟 Key Features

1. **🌲 Forest Themes & Mode Switcher**:
   - **Dark Forest Mode (Night Canopy)**: Deep evergreen obsidian background with ambient pine emerald and glowing ember lighting.
   - **Light Forest Mode (Daylight Woodland)**: Fresh misty sage green aesthetic with crisp frosted porcelain cards, dark pine typography, and high-contrast threat indicators.
   - 1-click theme toggle in the header with persistent memory via `localStorage`.

2. **Dual Input Systems**:
   - **🌤️ Weather Mode (Intuitive)**: Temperature (°C), Relative Humidity (%), Wind Velocity (km/h), 24h Rainfall (mm), Soil & Vegetation Drought Severity (1-5), and Forest Canopy Type (Coniferous, Deciduous, Mixed, Chaparral, Grassland).
   - **📐 Canadian FWI Advanced Mode**: Fine Fuel Moisture Code (FFMC), Duff Moisture Code (DMC), Drought Code (DC), and Initial Spread Index (ISI).

2. **Real-Time Probability Analytics**:
   - **Animated SVG Dial Gauge** dynamically tracking 0% to 100% wildfire catch likelihood.
   - **Categorical Danger Classification**: Low (Green), Moderate (Amber), High (Orange), and Extreme / Critical Danger (Ember Crimson).
   - **Diagnostic Metrics**: Derived composite FWI, Initial Spread Velocity (m/min), estimated Fuel Moisture %, and Initial Spread Index (ISI).
   - **Critical Factor Contribution**: Relative breakdown of how much Temperature, Aridity, Wind, and Rain suppress or accelerate danger.

3. **Scenario Presets**:
   - 1-click loading of realistic weather conditions: *Extreme Heatwave*, *Dry & High Winds*, *Typical Summer Forest*, *Recent Rain & Humid*, and *Prolonged Drought*.

4. **Actionable Prevention & Emergency Protocols**:
   - Automatically adapts recommended protocols (e.g. Total fire ban, air tanker staging, mandatory lookout flights, hot work bans) based on the calculated risk level.

5. **Bulk CSV Evaluation**:
   - Drag & drop or upload any CSV file to calculate fire probability across dozens or hundreds of forest parcels at once.
   - Preview evaluated rows and export the annotated dataset with fire danger ratings.
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

## 🔬 How Fire Probability is Calculated

The engine combines standard **Canadian Forest Fire Weather Index (FWI)** equations with a calibrated multi-variable logistic ensemble:

$$P(\text{Fire}) = \frac{1}{1 + e^{-z}}$$

Where $z$ is the log-odds of ignition:
$$z = \beta_0 + \beta_1(T - 20) + \beta_2(55 - RH) + \beta_3(W - 12) - \beta_4 \ln(1 + R) + \beta_5(D - 2.5)$$
Scaled by canopy flammability factors:
- **Chaparral / Shrubland**: 1.25x
- **Coniferous / Pine**: 1.18x
- **Grassland**: 1.15x
- **Mixed Canopy**: 1.00x
- **Deciduous Hardwood**: 0.85x

---

*Developed for wildfire research, forestry management, and environmental monitoring.*

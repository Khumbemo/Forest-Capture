# 🚀 Forest Capture v4.0 - Architectural Roadmap

This document serves as a blueprint for upgrading Forest Capture from v3.1 (Flora & Biomass focus) to v4.0 (Enterprise Ecosystem & PSP tracking). It outlines the 6 major missing features and the technical approach required to implement them using the existing Vanilla JS, IndexedDB, and Firebase stack.

---

## 1. Wildlife & Fauna Tracking
*Currently, the app is 100% flora-focused. To support holistic ecosystem surveys, a fauna module is required.*

**Technical Implementation:**
- **New Module:** `www/src/modules/fauna.js`
- **Data Schema:** 
  - `type`: "camera_trap" | "spoor_transect" | "point_count"
  - `species`: Integrated with a new offline taxonomy JSON (e.g., `mammals-india.json`).
  - `coordinates`: Auto-pulled via `gps.js`.
- **UI:** A specialized 10-minute countdown timer UI for Avian Point Counts, forcing the user to log bird calls within the standard time window.

---

## 2. Advanced Soil & Below-Ground Carbon
*Currently only logs pH, moisture, and humus depth. Needs full Soil Organic Carbon (SOC) capabilities.*

**Technical Implementation:**
- **Module Update:** Expand `environment.js` or create `soil.js`.
- **Data Schema:** Array of `horizons` (O, A, E, B, C).
  - `depth_cm`, `color` (Munsell chart hex code picker), `texture` (sand/silt/clay dropdown).
- **Analytics (`analytics.js`):** Add Soil Organic Carbon (SOC) calculations.
  - *Formula:* `SOC (t/ha) = Depth (cm) × Bulk Density (g/cm³) × Organic Carbon (%)`

---

## 3. Commercial Forestry & Timber Metrics
*Currently focuses on biomass and ecology. Needs commercial timber value assessment.*

**Technical Implementation:**
- **Module Update:** Expand `quadrat.js` tree data entry.
- **Data Schema:** 
  - `formFactor` (0.1 to 1.0)
  - `defectPct` (deductions for rot/hollow)
- **Analytics (`analytics.js`):** 
  - *Merchantable Volume Formula:* `Volume (m³) = Basal Area × Height × Form Factor × (1 - Defect%)`

---

## 4. Interactive Offline Mapping (GIS)
*Currently captures Lat/Long as text strings. Needs visual spatial awareness.*

**Technical Implementation:**
- **Dependency:** Add `Leaflet.js` to vendor libraries.
- **Offline Tiles:** Use Capacitor Filesystem API to download and store XYZ raster map tiles (e.g., OpenStreetMap or Mapbox) locally to the device so the map works without internet.
- **UI:** A new "Map" tab. Read `curPos` from `gps.js` and draw a blue dot. Plot all saved surveys as GeoJSON markers on the map.
- **Advanced:** Calculate polygon area by tracking the user's GPS path as they walk the perimeter of a stand.

---

## 5. Permanent Sample Plots (PSP) & Time-Series
*Currently treats every survey as a one-off event. Needs longitudinal tracking.*

**Technical Implementation:**
- **Data Schema:** 
  - Add `parentSurveyId` to link T1 to T0.
  - Add `treeTagId` (e.g., "A-001") to uniquely track individual trees.
- **UI Workflow:** A "Re-measure Plot" button that loads the historical T0 data, displays `previousDbh`, and asks for `currentDbh`.
- **Validation:** Strict UI warnings if `currentDbh < previousDbh` (negative growth check).
- **Analytics (`analytics-time.js`):**
  - *Periodic Annual Increment (PAI):* `(Biomass_T1 - Biomass_T0) / Years`
  - *Mortality Rate:* `1 - (Survivors / Initial)^(1/t)`

---

## 6. Hardware Integrations (Bluetooth)
*Enterprise researchers use digital calipers and laser rangefinders instead of manual typing.*

**Technical Implementation:**
- **API:** Use the experimental `Web Bluetooth API` (`navigator.bluetooth.requestDevice`).
- **Workflow:** 
  1. User pairs a device (e.g., Haglöfs digital caliper) via the app settings.
  2. The app listens to GATT characteristic value changes.
  3. When the user clicks the caliper button in the forest, the `DBH` input field in `quadrat.js` automatically populates with the exact millimeter measurement.

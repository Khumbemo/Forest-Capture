# Forest Capture: Full Application Documentation

## 1. Overview
**Forest Capture** is a robust, offline-first mobile web application designed to facilitate rigorous ecological field research. Built with Vanilla HTML/JS/CSS, it is meticulously optimized to be wrapped as an Android APK using Capacitor. The application is completely functional without an internet connection, relying on robust local storage and modular architecture designed for the field.

## 2. Technical Stack & Architecture
- **Frontend Core:** Vanilla HTML5, CSS3, and JavaScript (ES6 Modules). No heavyweight frontend frameworks like React or Vue are used in order to maintain maximum performance and minimal battery drain on low-end Android devices.
- **Data Persistence:** 
  - Offline-first standard utilizing `localStorage` and `IndexedDB` caching mechanisms.
  - Optional synchronization to Firebase (Firestore / Firebase Storage) when connectivity is restored.
- **Native Wrapper:** Ionic Capacitor serves as the bridge between the web application and native Android hardware APIs (Camera, GPS, local file system access).
- **Mapping Engine:** Leaflet.js integrating OpenStreetMap and satellite tiles. Tile data is actively cached to enable map viewing when cellular networks drop.

## 3. Module Details & Capabilities

### 📡 3.1. Dashboard & Telemetry
The primary landing screen.
- Initializes background tasks to fetch high-precision GPS positioning and calculates estimated positioning errors (e.g. ±3m).
- Dynamically fetches local environmental telemetry (temperature, humidity, pressure) using coordinates.

### 🧰 3.2. Data Collection Tools
- **Quadrat Tool:** Records species presence, estimated abundance, diameter at breast height (DBH), tree height, and crown class in bounded survey plots. Features offline autocomplete for taxonomic binomial nomenclature. 
- **Transect Tool:** For line-intercept sampling. Allows researchers to set bearings and record precise distance intercepts for respective flora or substrates.
- **Disturb & CBI Tool:** Records environmental matrices and disturbances (Fire, Grazing, Logging). Implements standard severity scaling for calculating the Composite Burn Index (CBI) over specific ecosystem stratums from substrates up to large tier trees.
- **Map Tool:** Provides spatial context via cached tiles, allows custom dropping of geo-waypoints, tracking paths, and exporting survey paths.

### 📸 3.3 Media & Annotation
- **Voice Notes & Photography:** Users can securely capture environment photos and acoustic ecosystem recordings. Saved locally as base64 or blob blobs, scaling down to prevent memory limits, before syncing to Firebase Storage containers.
- **Auto-fill GPS Notes:** Ping the precise coordinates to the OpenStreetMap Nominatim system to convert raw lat/long values into human-readable topography descriptions. 

### 📊 3.4. Analytics & Data Processing Engine
Instantly translates raw input strings into tangible scientific indices on the device:
- **Shannon-Wiener Diversity Index (H′):** Calculates `-Σ(p_i * ln(p_i))` using native Math.log base *e*.
- **Simpson’s Reciprocal Index:** Calculated exactly as `1 / λ` (where λ = Σ(n(n-1) / N(N-1))) representing true interpretative diversity.
- **Species Richness & Evenness (Pielou J′):** Automatically derived and visually compared against other historical quadrats utilizing Chart.js rendering.

### 💾 3.5. Export & Data Sovereignty
- **Formats:** Data is rigorously tracked and can be exported as `.json` blocks or `.csv` spreadsheets directly to the download folder of the Android device.
- **Pathways:** Waypoints and Transect headings can be compiled directly into `.gpx` standards for immediate ingest into QGIS/ArcGIS.
- **Offline Importer:** Allows full restoration of the application database between multiple hardware devices by loading `.json` exports back into memory.

## 4. Deployment Pipeline
The web assets (`/www`) are compiled natively into Android using `Capacitor` directives:
`npm run cap:sync` -> Populates native assets.
`cd android && gradlew assembleRelease` -> Generates the production APK and App Bundle (`.aab`) configured to target the Google Play Store environment.

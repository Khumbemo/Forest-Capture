# Forest Capture: Ecological Field Data Collection
*A Complete Feature Presentation & Demonstration Guide*

---

## 1. Introduction
**Forest Capture** is a research-grade, offline-first mobile web application designed strictly for ecological, forestry, and environmental field data collection. Built with a responsive, dynamic UI, it replaces bulky field sheets with highly localized, structured data entry workflows.

### 📱 Getting Started (The Demonstration)
> [!TIP]
> **To Show this off:** Open the app on your device and launch into the **Home Dashboard**. Point out the seamless entry transition and the clean, scientific dark-mode aesthetic.

---

## 2. Core Features & Tool Modules

### 📡 1. Live Telemetry Dashboard
The moment you open the app, it attempts to capture environmental baselines:
*   **Real-time GPS:** Displays live Latitude/Longitude and dynamic GPS precision error margins (e.g., ±4m).
*   **Altimeter:** Fetches high-accuracy altitude readings strictly for the current topography.
*   **Live Weather Integration:** Pulls dynamic temperature, humidity, and atmospheric conditions based on your geographic coordinates.

### 🧰 2. The Field Tools Menu
*Accessible via the bottom navigation bar (center icon).* Navigate here to show off the suite of specialized data modules.

````carousel
![Dashboard](/C:/Users/khumb/.gemini/antigravity/brain/7110acff-7aeb-4b38-92ac-8ba94d76bab0/home_screen_bottom_nav_1774924793013.png)
<!-- slide -->
![Field Tools](/C:/Users/khumb/.gemini/antigravity/brain/7110acff-7aeb-4b38-92ac-8ba94d76bab0/tools_screen_check_1774927486056.png)
````

#### 🗺️ Map & GPS Tool
*   **Demonstrate:** Dropping custom geographic waypoints.
*   **Key Features:** Switch between Satellite, Terrain, and Hybrid OSM layers. It automatically logs your path and allows export to GPX formats for QGIS/ArcGIS ingestion.

#### 🌲 Quadrat Sampling
*   **Demonstrate:** Tapping into Quadrats and defining standard plot dimensions (e.g., 10x10m).
*   **Key Features:** As you type species names, the **Built-in Taxonomic Autocomplete** (supporting deep databases of Tropical Asia and Temperate Flora) will automatically suggest scientific names, common names, and families. Record Abundance, DBH (cm), and Tree Height (m) concurrently.

#### 📏 Belt Transect
*   **Demonstrate:** Setting a transect heading (bearing) and distance. 
*   **Key Features:** Allows logging canopy cover intercepts at specific distance intervals, allowing rapid line-point intercept measurements without breaking workflow.

#### 🌱 Environment & Disturbances (CBI)
*   **Demonstrate:** The 1-Tap "Auto-fill Env Data" that instantly pulls the live telemetry into the environmental schema.
*   **Key Features:** Log slope, aspect, and manually record severity (0-5) across human, fire, and grazing disturbances to generate a Composite Burn Index (CBI) estimation.

#### 🎙️ Media & GPS Location Auto-fill
*   **Demonstrate:** The **"📍 Auto-fill Location"** button inside the Media/Notes section. 
*   **Key Features:** Tapping this instantly queries the OpenStreetMap Nominatim API, effectively converting your raw GPS coordinates into a highly readable human text address mapped straight into your localized field notes. You can also capture photos and acoustic landscape voice notes.

---

## 3. Data Flow & Security

### 📊 The Analytics Engine
> [!IMPORTANT]
> **To Show this off:** Save a mock quadrat survey with a few species, then jump to the **Compare Surveys** or **Analytics** module.

The application automatically parses captured flora to calculate hard ecological indices instantly in the field, including:
*   **Shannon-Wiener Diversity (H')**
*   **Simpson’s Index (D)**
*   **Species Evenness (J')**
*   **Importance Value Index (IVI)**
*   *It also generates dynamic JavaScript-based DBH curve histograms right on the device screen.*

### 💾 Complete Data Sovereignty & Export (Data Screen)
All captured information is secured locally inside the browser's persistent `IndexedDB` layer. Nothing is lost if the cellular radio dies.

*   Navigate to the **Data** tab to show the chronological sequence of saved research points.
*   Under **Settings**, you can demonstrate exporting the entire schema as compressed JSON, raw CSV spreadsheets, or a standalone GPX telemetry trace. 
*   **Offline Restoration:** The app supports direct offline restoration. If you change devices, you can securely inject your exported database right back into the tool.

---

### Presentation Talking Points
1. **Speed & Efficiency:** Focus on how the layout prevents "menu diving". Every tool is 1 tap away.
2. **Reliability:** Emphasize that the app fundamentally works offline. The map tile caching, taxonomic dictionaries, and analytics matrices do not require a cloud server to execute perfectly.
3. **Hardware Agnostic:** Mention how it operates on Android WebViews through Capacitor, utilizing native device hardware (Camera, GPS, Microphone) through web protocols.

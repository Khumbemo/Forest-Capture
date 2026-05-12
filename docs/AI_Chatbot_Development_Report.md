# Forest Capture: Deep Technical Report for AI Chatbot Integration

This report provides a comprehensive breakdown of the **Forest Capture** application to facilitate the development of an integrated AI chatbot. Forest Capture is a research-grade, offline-first mobile application designed for ecological and forestry field data collection.

---

## 1. Core Architecture & Philosophy
*   **Offline-First Standard:** Built with a primary dependency on local storage. The app must function perfectly in remote forest environments without cellular connectivity.
*   **Vanilla Tech Stack:** 
    *   **Frontend:** Vanilla HTML5, CSS3 (Custom Design System), and JavaScript (ES6 Modules).
    *   **Native Wrapper:** Ionic Capacitor (targets Android APK).
    *   **Database:** Dual-layer persistence using **IndexedDB** (local snappiness) and **Firebase Firestore** (cloud sync).
*   **Modular Design:** Every field tool (Quadrat, Transect, etc.) is a self-contained ES module in `src/modules/`.

---

## 2. Deep Data Schema & Entities

To build an effective AI chatbot, it must understand the underlying data structures it will query or mutate.

### 2.1. The `Survey` Object (Root)
The primary unit of data. Everything is contained within a Survey.
*   `id`: UUID (String)
*   `name`: User-defined survey name.
*   `date`: ISO Date string.
*   `location`: Human-readable location or GPS string.
*   `quadrats`: Array of Quadrat objects.
*   `transects`: Array of Transect objects.
*   `disturbances`: Object containing environmental/CBI data.
*   `photos`/`audioNotes`: Arrays of media references (`mediaId`).

### 2.2. Field Tool Entities
| Entity | Key Data Fields | Scientific Logic |
| :--- | :--- | :--- |
| **Quadrat** | Species Name (Scientific), DBH (cm), Abundance, Height (m), Crown Class. | Uses `species-autocomplete.js` for taxonomic validation. |
| **Transect** | Intercept distance, Bearing, Substrate/Species type. | Line-intercept sampling for density estimation. |
| **Prism Sweep** | BAF (Basal Area Factor), Tree Count, Species tallies. | Calculates Basal Area per Hectare. |
| **CBI (Disturbance)** | Fire/Grazing/Logging severity (0-5), Strata-wise damage. | Calculates **Composite Burn Index**. |
| **Herbarium** | Voucher ID, Phenology, GPS, Associated Photos. | Standardized specimen collection records. |

### 2.3. Media Handling (`storage.js`)
*   **MediaStore:** Blobs (Photos/Audio) are stored separately in IndexedDB using `mediaId` prefixes to keep main JSON documents small (<1MB for Firestore compatibility).
*   **AI Opportunity:** The chatbot can process these blobs (e.g., "Identify this leaf photo").

---

## 3. Intelligence & Analytics Layer

### 3.1. Ecological Indices (`analytics.js`)
The app calculates complex indices on-device:
*   **Shannon-Wiener Index (H'):** Diversity measure.
*   **Simpson’s Index (D):** Dominance measure.
*   **Pielou’s Evenness (J'):** How evenly species are distributed.
*   **Importance Value Index (IVI):** Combines relative density, frequency, and dominance.

### 3.2. Taxonomic Intelligence (`species-autocomplete.js`)
*   Contains localized JSON databases (e.g., `india-nagaland.json`) with thousands of scientific names.
*   **AI Opportunity:** The chatbot can act as a "Taxonomic Assistant," helping users find correct binomial names based on common names or descriptions.

---

## 4. Hardware & Contextual APIs
The chatbot can "sense" the environment through existing modules:
*   **GPS (`gps.js`):** High-precision coordinates and altitude.
*   **Weather (`weather.js`):** Real-time Temp/Humidity/Wind via OpenWeatherMap.
*   **Maps (`map.js`):** Leaflet integration with offline tile support.

---

## 5. Strategic AI Integration Points

For a "Vertex AI" or "Gemini" powered chatbot, the following hooks are recommended:

### A. Natural Language Data Entry
*   **Action:** "Add a 45cm DBH Teak tree to the current quadrat."
*   **Implementation:** Chatbot parses the string, fetches the active survey via `Store.getActive()`, and calls `addSpeciesEntry()` in `quadrat.js`.

### B. Field Diagnostic Assistant
*   **Action:** "What is the CBI for a forest with moderate canopy scorch but healthy understory?"
*   **Implementation:** Chatbot retrieves the CBI methodology from a Knowledge Base and guides the user through the `disturbance.js` form.

### C. Live Analytics Synthesis
*   **Action:** "Compare the diversity of this plot to the one I did yesterday."
*   **Implementation:** Chatbot queries `Store.getSurveys()`, passes data to `analytics.js` for two surveys, and summarizes the delta in H' or IVI.

### D. Multi-modal Identification
*   **Action:** User uploads a photo of a disease/pest.
*   **Implementation:** Chatbot sends the blob to Gemini Multimodal, identifies the issue, and logs it as a "Note" in `notes.js` with GPS coordinates.

---

## 6. Development Priorities for the Chatbot
1.  **Bridge Module:** Create `src/modules/ai.js` to handle API calls to Vertex AI.
2.  **Context Injection:** Feed the chatbot the current `settings` (Language, Units) and the `activeSurvey` state on every prompt.
3.  **Command Mapping:** Define a manifest of "App Actions" (e.g., `SWITCH_SCREEN`, `SAVE_DATA`, `START_TIMER`) that the AI can trigger via a JSON-response format.
4.  **Offline Buffering:** Since the AI requires internet, implement a "Query Queue" that syncs when the connectivity dot in the dashboard turns green.

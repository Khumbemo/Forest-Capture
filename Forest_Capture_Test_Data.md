# Forest Capture: Evaluation Test Data
**Use this mock dataset to fully test the ecological modules, autocomplete triggers, and analytics engine within the app.**

---

### Phase 1: Create a New Survey
*Open the app, go to **Tools**, and tap **New Survey**.*

*   **Survey Name:** `Baseline Plot A — Tropical Ridge`
*   **Location:** `Dehradun Validation Site` (Or check "Auto-fill GPS")
*   **Investigator:** `Your Name`
*   **Date:** *(Today's Date)*

---

### Phase 2: Map & GPS Waypoints
*Tap the **Map & GPS** tool.*

1. Allow location permissions if prompted.
2. Tap the **"Drop Waypoint"** button (`+` icon).
3. **Waypoint Note:** `Plot A - NW Corner Marker`
4. Walk 10 meters and drop another: `Plot A - NE Corner Marker`

---

### Phase 3: Quadrat Sampling (Tree Data)
*Tap the **Quadrat** tool. Set dimensions to `10` x `10` meters.*
*Type the species name slowly to trigger the built-in Autocomplete Dictionary!*

| Scientific Name (Type this) | Common Name | Abundance | DBH (cm) | Height (m) | Phenology |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Shorea robusta`** | Sal | 4 | 55.2 | 28.5 | Flowering |
| **`Tectona grandis`** | Teak | 2 | 42.1 | 22.0 | Vegetative |
| **`Pinus roxburghii`** | Chir Pine | 1 | 65.8 | 31.0 | Fruiting |
| **`Dalbergia sissoo`** | Shisham | 3 | 25.4 | 12.5 | Vegetative |

> **Why this matters:** Tapping "Save Quadrat" will feed these 4 species and their measurements directly into the Analytics Engine to calculate biodiversity indices later!

---

### Phase 4: Belt Transect (Line Intercepts)
*Tap the **Transect** tool.*

*   **Bearing / Heading:** `45°` (North-East)
*   **Transect Length:** `30` meters
*   **Width:** `2` meters (Belt Transect)

**Log the following intercepts along the tape measure:**

*   **At 10m:** Canopy Intercepted! Height: `18m` | Species: `Shorea robusta`
*   **At 20m:** Canopy Gap (No intercept) | Height: `0`
*   **At 30m:** Canopy Intercepted! Height: `24m` | Species: `Tectona grandis`

---

### Phase 5: Environmental Baselines
*Tap the **Environment** tool.*

1. Tap **"Auto-fill Env Data"** at the top. This will automatically pull your live GPS altitude and current weather (temperature/humidity).
2. **Slope:** `15` degrees
3. **Aspect:** `180` degrees (South-facing)
4. **Estimated Canopy Cover:** `65` %
5. **Soil Type:** `Loamy Clay`
6. Tap **"Save Environment"**.

---

### Phase 6: Disturbance & CBI (Composite Burn Index)
*Tap the **Disturb & CBI** tool.*

*   **Grazing:** Check the box. Set severity slider to `2` (Light/Moderate browsing).
*   **Logging/Harvesting:** Check the box. Set severity slider to `1` (Minor selective cuts).
*   **Fire:** Leave unchecked.
*   **Human Footprint:** Check the box. Set severity slider to `3` (Trails present, some trampling).

> **Why this matters:** The app automatically parses these integers into a 0-5 graded Composite Burn/Disturbance index.

---

### Phase 7: Media & Notes
*Tap the **Media** tool.*

1. Tap the **"📍 Auto-fill Location"** button. Wait 2 seconds. It will pull a raw text address (Reverse Geocoding) from OpenStreetMap natively into the textbox!
2. **Write a note:** `Camera trap setup near the large Sal tree. Significant trail erosion observed on the southern slope.`
3. Tap **"Save Note"**.

---

### ✅ Phase 8: Verification & Analytics
Now that your survey is loaded with real ecological mock data:

1. Go to the **Settings** Menu (Gear icon top right).
2. Tap **Analytics / Compare**.
3. You will immediately see beautiful DBH Distribution Histograms, Species Accumulation Curves, and calculated stats like **Shannon-Wiener Diversity (H')** and **Simpson's Index** based specifically on the mock Quadrat data you entered! 
4. Check the **Data** tab to see your entire formatted survey history.

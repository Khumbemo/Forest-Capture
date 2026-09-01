// src/modules/ai-offline-guide.js
// Layer 1 of SylvX's offline capability: a deterministic, zero-dependency
// keyword-matched guide covering "how do I use X" and "what is formula Y"
// questions. No network, no model download, runs on any device instantly.
// This is deliberately NOT a language model — it never invents an answer;
// if nothing matches confidently, matchOfflineGuide() returns null so the
// caller can fall through to the next offline layer (or say so plainly).

const ENTRIES = [
  {
    id: 'quadrat',
    keywords: ['quadrat', 'plot sampling', 'dbh', 'diameter at breast height'],
    answer: 'Quadrat records species within a bounded plot: name, life stage, abundance, DBH (cm), GBH, height, crown class, stratum, and phenology per individual/species. Open it from Tools → Quadrat, set the plot size and shape, then add a species entry per individual or species group. Tap "Save Quadrat Data" when done — you can add more species to the same quadrat later.'
  },
  {
    id: 'transect',
    keywords: ['transect', 'belt transect', 'line intercept', 'bearing'],
    answer: 'Belt Transect is for line-intercept sampling: set a bearing and total distance, then log canopy or substrate intercepts at each distance point as you walk the line. Open it from Tools → Belt Transect.'
  },
  {
    id: 'prism',
    keywords: ['prism', 'prism sweep', 'baf', 'basal area factor', 'variable radius'],
    answer: 'Prism Sweep estimates basal area per hectare using a variable-radius plot: set your Basal Area Factor (BAF), then tally each "in" tree by species while sighting through the prism from plot center. Open it from Tools → Prism Sweep.'
  },
  {
    id: 'cbi',
    keywords: ['cbi', 'composite burn index', 'disturbance', 'fire severity', 'burn severity'],
    answer: 'Disturbance & CBI records severity (0–5) for human, fire, and grazing disturbance across vegetation strata (substrate, herbaceous, shrub, intermediate, overstory), then rolls those into a Composite Burn Index estimate. Open it from Tools → Disturbance & CBI — there’s a 1-tap "Auto-fill Env Data" to pull in live slope/aspect first.'
  },
  {
    id: 'environment',
    keywords: ['environment tool', 'slope', 'aspect', 'soil ph', 'humus depth'],
    answer: 'The Environment tool records slope, aspect, and soil condition (pH, moisture, humus depth). Tap "Auto-fill Env Data" to pull live GPS/weather/slope readings straight into the form instead of typing them by hand.'
  },
  {
    id: 'map',
    keywords: ['map tool', 'waypoint', 'gps track', 'gpx export', 'offline map'],
    answer: 'The Map tool is a Leaflet-based offline map: drop waypoints, track your path, switch satellite/terrain/hybrid layers, and export your track or waypoints to GPX for QGIS/ArcGIS. Tiles you’ve already viewed are cached for offline use.'
  },
  {
    id: 'herbarium',
    keywords: ['herbarium', 'voucher', 'specimen record'],
    answer: 'Herbarium records standardized specimen vouchers — voucher ID, phenology, GPS, and associated photos. Open it from Tools → Herbarium.'
  },
  {
    id: 'germplasm',
    keywords: ['germplasm', 'seed lot', 'nbpgr', 'ista'],
    answer: 'Germplasm records seed/germplasm collections in NBPGR/ISTA-aligned fields (IC number, seed lot, certification). Open it from Tools → Germplasm.'
  },
  {
    id: 'clinometer',
    keywords: ['clinometer', 'measure height', 'measure slope with phone'],
    answer: 'The Clinometer tool uses your device’s motion sensors to measure slope angle and, with a known baseline distance, tree height. Open it from Tools → Clinometer and follow the on-screen sighting steps.'
  },
  {
    id: 'export',
    keywords: ['export', 'backup', 'restore data', 'csv', 'darwin core', 'pdf report', 'word report'],
    answer: 'From the Data tab, you can export a survey as CSV, JSON, GPX, PDF, or Word, or export species lists in Darwin Core format for biodiversity databases. "Backup All" saves your entire local database as one JSON file, and you can restore it later on this or another device — no internet needed for any of this.'
  },
  {
    id: 'notes',
    keywords: ['notes', 'voice note', 'audio note', 'field note'],
    answer: 'Notes & Media let you attach free-text notes, photos, and voice memos to a survey or a specific quadrat. There’s a 1-tap GPS-to-address auto-fill for notes when you’re online.'
  },
  {
    id: 'shannon',
    keywords: ['shannon', 'shannon-wiener', 'diversity index', "shannon's index"],
    answer: "Shannon-Wiener diversity index (H'): H' = −Σ(pᵢ × ln(pᵢ)), where pᵢ is the proportion of individuals belonging to species i. Higher H' means more species, more evenly distributed. It's calculated automatically in the Analytics tool once you've logged quadrat species."
  },
  {
    id: 'simpson',
    keywords: ['simpson', "simpson's index", 'simpson diversity', 'dominance index'],
    answer: "Simpson's Index (D) measures dominance: D = Σ(nᵢ(nᵢ−1)) / (N(N−1)), where nᵢ is the count of species i and N is total individuals. The app reports 1−D (Simpson's Reciprocal), so higher values mean more diversity, matching Shannon's direction."
  },
  {
    id: 'evenness',
    keywords: ['evenness', "pielou", "pielou's evenness", "j'"],
    answer: "Pielou's Evenness (J') = H' / ln(S), where H' is Shannon diversity and S is species richness. It ranges 0–1 and tells you how evenly abundance is spread across species, independent of how many species there are."
  },
  {
    id: 'ivi',
    keywords: ['ivi', 'importance value index'],
    answer: 'Importance Value Index (IVI) = Relative Density + Relative Frequency + Relative Dominance (basal area), on a 0–300 scale. It ranks which species structurally dominate a site, combining how common, how widespread, and how large each species is.'
  },
  {
    id: 'basal-area',
    keywords: ['basal area', 'basal area per hectare'],
    answer: 'Basal area is the cross-sectional area of a tree trunk at breast height, summed across trees and scaled to per-hectare. The app computes it automatically from DBH in Quadrat and Prism Sweep data — see it under Analytics.'
  }
];

// Score = number of distinct keyword phrases found as substrings of the
// (lowercased) query. A match needs at least one hit; ties keep the
// earliest-defined entry, so put more specific topics first if they
// share a keyword with a broader one.
export function matchOfflineGuide(query) {
  const q = (query || '').toLowerCase();
  if (!q.trim()) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of ENTRIES) {
    const score = entry.keywords.reduce((n, kw) => n + (q.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best ? best.answer : null;
}

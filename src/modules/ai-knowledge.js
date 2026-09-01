// src/modules/ai-knowledge.js
// Static app knowledge fed to SylvX's system prompt, plus the Gemini
// function-calling tool schema and the "how to describe a pending write"
// text used by the confirm-before-write flow in ai.js.

export const APP_KNOWLEDGE = `
Forest Capture is an offline-first field survey app for forestry, ecology,
and biodiversity research. Screens/tools available from the bottom nav
(Home, Tools, Data, AI Chat) and the Tools grid:

- Quadrat: bounded-plot species sampling — records species name, life
  stage, abundance, DBH, GBH, height, crown class, stratum, phenology,
  health, and more per individual/species.
- Belt Transect: line-intercept sampling — bearing, distance, and
  substrate/species intercepts along a transect line.
- Prism Sweep: variable-radius plot sampling using a Basal Area Factor
  (BAF) to estimate basal area per hectare from tree tallies.
- Environment: slope, aspect, soil (pH, moisture, humus depth), and other
  site condition fields, with a 1-tap auto-fill from live GPS/weather.
- Disturbance & CBI: severity scoring (0-5) for human, fire, and grazing
  disturbance across vegetation strata, rolled up into a Composite Burn
  Index (CBI) estimate.
- Map: Leaflet-based offline map — drop waypoints, track a path, switch
  satellite/terrain/hybrid layers, export to GPX.
- Herbarium: standardized specimen voucher records (voucher ID, phenology,
  GPS, photos).
- Germplasm: NBPGR/ISTA-aligned seed/germplasm collection records.
- Clinometer: device-sensor-based slope and height measurement tool.
- Analytics: on-device ecological indices — Shannon-Wiener diversity (H'),
  Simpson's dominance (D), Pielou's evenness (J'), Importance Value Index
  (IVI), basal area, and DBH histograms — plus a Compare Surveys view.
- Calculation: a lightweight standalone diversity/cover calculator.
- Data / Export: browse saved surveys; export as CSV, JSON, GPX, PDF, or
  Word; back up and restore the whole local database as JSON; export
  species lists in Darwin Core format.
- Notes & Media: free-text field notes (with 1-tap GPS-to-address
  auto-fill), photos, and voice memos, attachable to a survey or quadrat.

Data model: everything lives under a Survey (id, name, date, location),
which contains arrays of quadrats, transects, disturbances, notes, photos,
and audio notes. All data is stored locally in IndexedDB first; Firebase
sync is optional and additive, never required for the app to work.

When a user asks how to do something in the app, explain it using this
structure — name the exact screen/button, and mention relevant fields.
Keep answers concise and suitable for a mobile chat interface.
`.trim();

// Gemini function-calling tool declarations. "add_species_entry" and
// "add_note" are mutating and MUST go through the confirm-before-write UI
// in ai.js — never execute them directly from a model response.
export const TOOL_DECLARATIONS = [
  {
    name: 'add_species_entry',
    description: 'Add a species/individual record to an existing quadrat in the active survey. Requires the quadrat to already exist — never invents a new quadrat number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        quadratNumber: { type: 'NUMBER', description: 'The number of an existing quadrat in the active survey to add this species to.' },
        speciesName: { type: 'STRING', description: 'Scientific or common name of the species.' },
        abundance: { type: 'NUMBER', description: 'Count of individuals. Defaults to 1.' },
        dbh: { type: 'NUMBER', description: 'Diameter at breast height, in centimeters, if known.' },
        height: { type: 'NUMBER', description: 'Tree/plant height, in meters, if known.' },
        stage: { type: 'STRING', description: 'Life stage: tree, sapling, seedling, climber, shrub, or herb. Defaults to tree.' }
      },
      required: ['quadratNumber', 'speciesName']
    }
  },
  {
    name: 'add_note',
    description: 'Add a free-text field note to the active survey — e.g. to log a photo-based species/pest identification, or any observation the user asks to record.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'The note text.' },
        category: { type: 'STRING', description: 'One of: general, observation, hazard, identification. Defaults to general.' },
        quadratNumber: { type: 'NUMBER', description: 'Optional quadrat number this note refers to.' }
      },
      required: ['text']
    }
  },
  {
    name: 'compare_surveys',
    description: "Read-only. Compare ecological indices (species richness, Shannon-Wiener H', Simpson's D, evenness, basal area) between two saved surveys by name.",
    parameters: {
      type: 'OBJECT',
      properties: {
        surveyNameA: { type: 'STRING', description: "Name of the first survey (e.g. today's, or the active one)." },
        surveyNameB: { type: 'STRING', description: 'Name of the second survey to compare against.' }
      },
      required: ['surveyNameA', 'surveyNameB']
    }
  },
  {
    name: 'lookup_taxonomy',
    description: "Read-only. Look up a species by common or scientific name against the locally downloaded regional taxonomy pack and this survey's previously logged species. Works fully offline.",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'A common name, partial scientific name, or family name to search for.' }
      },
      required: ['query']
    }
  }
];

const WRITE_TOOLS = new Set(['add_species_entry', 'add_note']);

export function isWriteTool(name) {
  return WRITE_TOOLS.has(name);
}

// Human-readable summary of a pending write, shown on the confirm card.
export function describeWriteCall(name, args) {
  if (name === 'add_species_entry') {
    const bits = [`Add "${args.speciesName || 'Unknown species'}"`];
    if (args.abundance) bits.push(`× ${args.abundance}`);
    if (args.dbh) bits.push(`DBH ${args.dbh}cm`);
    if (args.height) bits.push(`height ${args.height}m`);
    bits.push(`to Quadrat #${args.quadratNumber}`);
    return bits.join(', ');
  }
  if (name === 'add_note') {
    const cat = args.category ? ` (${args.category})` : '';
    const q = args.quadratNumber ? ` — Quadrat #${args.quadratNumber}` : '';
    return `Add note${cat}${q}: "${args.text}"`;
  }
  return `Run ${name}`;
}

// src/modules/germplasm.js

import { $, $$, toast, switchScreen, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { curPos } from './gps.js';

// ─── DATA CONSTANTS ───────────────────────────────────────────────
const SEED_ZONES = ["Zone I – Tropical Wet Evergreen","Zone II – Tropical Semi-Evergreen","Zone III – Tropical Moist Deciduous","Zone IV – Littoral & Swamp","Zone V – Tropical Dry Deciduous","Zone VI – Tropical Thorn","Zone VII – Tropical Dry Evergreen","Zone VIII – Sub-Tropical Broad-Leaved Hill","Zone IX – Sub-Tropical Pine","Zone X – Sub-Tropical Dry Evergreen","Zone XI – Montane Wet Temperate","Zone XII – Himalayan Moist Temperate","Zone XIII – Himalayan Dry Temperate","Zone XIV – Sub-Alpine","Zone XV – Alpine","Zone XVI – Andaman & Nicobar"];
const ICFRE_CATEGORIES = [{ value: "source_identified", label: "Source-Identified", desc: "Seed from demarcated seed zones, approved by Designated Authority" },{ value: "selected", label: "Selected Reproductive Material", desc: "From stands/cultivars meeting minimum ICFRE standards" },{ value: "orchard_untested", label: "Seed Orchard – Untested", desc: "Single-species untested orchard, single region/provenance" },{ value: "orchard_tested", label: "Seed Orchard – Tested", desc: "Genetically tested seed orchards" },{ value: "parents_families", label: "Parents / Full-Sib Families", desc: "From known parental combinations in controlled crosses" },{ value: "clones", label: "Clones", desc: "Vegetatively propagated material from selected genotypes" }];
const STAND_TYPES = ["Natural Forest","Plantation","Agro-forestry","Seed Orchard","Avenue / Roadside","Sacred Grove","Degraded Land"];
const MATURITY_STAGES = ["Immature","Physiologically mature","Full ripe","Over-ripe / Shattering"];
const COLLECTION_METHODS = ["Hand picking from tree","Ground collection","Beating / Shaking","Climbing / Rope access","Ladder","Pole harvester"];
const NBPGR_BIO_STATUS = ["Landrace","Cultivar/Variety","Breeding Line","Genetic Stock","Wild","Weedy","Mutant","Other"];
const NBPGR_STORAGE_TYPES = ["Orthodox","Recalcitrant","Intermediate","Unknown"];
const NBPGR_STORAGE_CONDITIONS = [{ value: "base", label: "Base Collection – −18 to −20°C, 3–7% MC" },{ value: "active", label: "Active Collection – 4°C, ≤35% RH" },{ value: "cryobank", label: "Cryobank – Liquid Nitrogen (−196°C)" },{ value: "invitro", label: "In Vitro Conservation" }];
const NBPGR_ACQUISITION = ["Exploration/Collection","Donation","Exchange","Purchase","Other"];
const ISTA_CERT_TYPES = ["ISTA Orange Certificate","ISTA Blue Certificate (Reduced)","ISTA Green Certificate (Seed Lot)","OECD Forest Scheme – Source-Identified","OECD Forest Scheme – Selected","OECD Forest Scheme – Qualified","OECD Forest Scheme – Tested"];
const ISTA_GERM_SUBSTRATE = ["Top of paper (TP)","Between paper (BP)","Sand (S)","Rolled paper (RP)","Soil"];
const ISTA_DORMANCY = ["None","Physical dormancy","Physiological dormancy","Combined dormancy","Unknown"];

const BODIES = {
  icfre: { 
    id:"icfre", name:"ICFRE", full:"Indian Council of Forestry Research & Education", 
    ministry:"MoEF&CC, Govt. of India", focus:"Field Collection & Seed Certification", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><path d="M50 85 V45 M50 55 L30 35 M50 65 L75 45" stroke="var(--emerald)" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="50" cy="35" r="15" fill="var(--emerald-glow)" stroke="var(--emerald)" stroke-width="2" stroke-dasharray="2 2" class="anim-svg-flow"/><path d="M30 85 H70" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"/></svg>`, 
    tag:"Forest Seed Management Manual · SOPs 2023", 
    desc:"For forest seed field collection, seed zone demarcation, reproductive material categorisation, and stand/mother-tree documentation as per ICFRE/MoEF guidelines." 
  },
  nbpgr: { 
    id:"nbpgr", name:"ICAR-NBPGR", full:"National Bureau of Plant Genetic Resources", 
    ministry:"ICAR, Govt. of India", focus:"Ex-Situ Genebank Conservation", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><rect x="35" y="40" width="30" height="45" rx="5" stroke="var(--sky)" stroke-width="3" fill="var(--sky-glow)"/><path d="M40 50 Q50 40 60 50 Q50 60 40 50" stroke="var(--sky)" stroke-width="2" fill="none" class="anim-svg-flow"/><path d="M35 35 H65" stroke="var(--text-muted)" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="25" r="5" fill="var(--amber)"/><path d="M50 30 V35" stroke="var(--amber)" stroke-width="2"/></svg>`, 
    tag:"National Genebank Standards · Passport Data Protocol", 
    desc:"For accession passport documentation, IC number assignment, drying/storage protocols, seed viability, plant quarantine clearance, and MTA compliance for the National Genebank." 
  },
  ista: { 
    id:"ista", name:"ISTA / OECD", full:"International Seed Testing Association / OECD Forest Scheme", 
    ministry:"International Standards (adopted by India)", focus:"Seed Testing & Trade Certification", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><path d="M30 85 H70 M50 85 V75 M50 75 L35 55 L45 35 L65 55 L55 75 Z" stroke="var(--violet)" stroke-width="3" fill="var(--violet-glow)"/><circle cx="55" cy="45" r="8" stroke="var(--cyan)" stroke-width="2" fill="none"/><path d="M70 45 L85 45" stroke="var(--cyan)" stroke-width="2" class="anim-svg-flow"/><rect x="35" y="20" width="10" height="5" stroke="var(--violet)" stroke-width="2" fill="none"/></svg>`, 
    tag:"ISTA Rules 2024 · OECD Forest Seed Scheme", 
    desc:"For seed lot certification, purity analysis, germination testing, moisture content, 1000-seed weight, vigour testing, and OECD forest scheme certification for domestic/international trade." 
  }
};

const emptyICFRE = ["speciesScientific","speciesCommon","family","localName","category","seedZone","collectionDate","collectionTime","collectorName","institution","permitNo","latitude","longitude","altitude","district","state","forestDivision","rangeNo","beatNo","compartmentNo","standType","treeAge","treeCount","motherTreeId","treeDiameter","treeHeight","collectionMethod","seedQuantityKg","seedQuantityUnits","maturityStage","phenologicalState","processingDate","packagingType","labelNo","remarks"];
const emptyNBPGR = ["speciesScientific","speciesCommon","family","icNumber","accessionNo","biologicalStatus","acquisitionMode","acquisitionDate","donorName","donorInstitution","collectionCountry","collectionState","collectionDistrict","latitude","longitude","altitude","pedigree","uniqueTrait","storageType","storageCondition","moistureContent","seedWeight1000","viabilityInitial","viabilityCheckDate","dryingMethod","dryingRH","dryingTemp","packagingType","containerType","healthStatus","quarantineStatus","pestReport","repatriationStatus","materialTransferAgreement","remarks"];
const emptyISTA = ["speciesScientific","speciesCommon","family","seedLotNo","certType","submittingLab","testingLab","samplingOfficer","samplingDate","lotSizeKg","sampleSizeG","originCountry","originState","originSeedZone","pureSeedPct","otherCropPct","weedSeedPct","inertMatterPct","germSubstrate","germTemp","germDuration","germNormalPct","germAbnormalPct","freshUngermPct","hardSeedPct","dormancyType","dormancyTreatment","moistureContent","moistureMethod","weight1000Seed","vigourTest","vigourResult","healthTests","pathogensFound","oecdCertNo","oecdRegion","oecdCategory","oecdApprovedStand","validityPeriod","remarks"];

let currentBody = null;
let currentView = 'home'; // home, form, list

// ─── UI GENERATORS ────────────────────────────────────────────────
function getSelectHtml(id, label, options, placeholder="Select...", full=false, tip="") {
  const opts = options.map(o => typeof o === "string" ? `<option value="${o}">${o}</option>` : `<option value="${o.value}">${o.label}</option>`).join('');
  return `
    <div class="form-group ${full ? 'flex-full' : ''}">
      <label for="${id}">${label}</label>
      <select id="${id}"><option value="">${placeholder}</option>${opts}</select>
      ${tip ? `<div class="form-hint">${tip}</div>` : ''}
    </div>
  `;
}
function getInputHtml(id, label, ph="", type="text", step="", full=false, tip="") {
  return `
    <div class="form-group ${full ? 'flex-full' : ''}">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" placeholder="${ph}" ${step ? `step="${step}"`:''} />
      ${tip ? `<div class="form-hint">${tip}</div>` : ''}
    </div>
  `;
}
function getTextareaHtml(id, label, ph="", rows=2, full=true) {
  return `
    <div class="form-group ${full ? 'flex-full' : ''}">
      <label for="${id}">${label}</label>
      <textarea id="${id}" placeholder="${ph}" rows="${rows}"></textarea>
    </div>
  `;
}
function getSection(title, icon, children) {
  return `
    <div class="form-card">
      <div class="section-title-row">
        <h3 class="card-title">${icon ? icon + " " : ""}${title}</h3>
      </div>
      <div class="form-row">
        ${children}
      </div>
    </div>
  `;
}

function renderICFRE() {
  let h = getSection("Species Passport", "",
    getInputHtml('germ_icfre_speciesScientific', 'Scientific Name *', 'e.g. Tectona grandis', 'text', '', true) +
    getInputHtml('germ_icfre_speciesCommon', 'Common Name', 'e.g. Teak') +
    getInputHtml('germ_icfre_localName', 'Local / Vernacular Name', 'e.g. Sagwan') +
    getInputHtml('germ_icfre_family', 'Family', 'e.g. Lamiaceae')
  );
  h += getSection("Reproductive Material Category", "",
    getSelectHtml('germ_icfre_category', 'Category', ICFRE_CATEGORIES, 'Select...', true) +
    getSelectHtml('germ_icfre_seedZone', 'Seed Zone (ICFRE Zonation)', SEED_ZONES, 'Select...', true) +
    getInputHtml('germ_icfre_permitNo', 'Collection Permit No.', 'Permit / Sanction No.') +
    getInputHtml('germ_icfre_labelNo', 'Label No.', 'Seed lot label')
  );
  h += getSection("Collection Details", "",
    getInputHtml('germ_icfre_collectionDate', 'Date', '', 'date') +
    getInputHtml('germ_icfre_collectionTime', 'Time', '', 'time') +
    getInputHtml('germ_icfre_collectorName', 'Collector Name', 'Full name') +
    getInputHtml('germ_icfre_institution', 'Institution', 'e.g. FRI Dehradun') +
    getSelectHtml('germ_icfre_collectionMethod', 'Collection Method', COLLECTION_METHODS, 'Select...', true)
  );
  h += getSection("Location", "",
    getInputHtml('germ_icfre_state', 'State', 'State') +
    getInputHtml('germ_icfre_district', 'District', 'District') +
    getInputHtml('germ_icfre_forestDivision', 'Forest Division', 'Division') +
    getInputHtml('germ_icfre_rangeNo', 'Range No.', 'e.g. R-3') +
    getInputHtml('germ_icfre_beatNo', 'Beat No.', 'e.g. B-7') +
    getInputHtml('germ_icfre_compartmentNo', 'Compartment No.', 'e.g. 12A') +
    getInputHtml('germ_icfre_latitude', 'Latitude', 'e.g. 11.4102', 'number', '0.000001') +
    getInputHtml('germ_icfre_longitude', 'Longitude', 'e.g. 76.6950', 'number', '0.000001') +
    getInputHtml('germ_icfre_altitude', 'Altitude (m asl)', 'e.g. 1200', 'number') +
    // FIX #3: Unique ID — distinct from NBPGR GPS button.
    `<div class="form-group" style="flex:0 0 auto; align-self:flex-end;"><button type="button" class="btn btn-accent gps-fill-btn" id="btnGermICFREGPS">Auto GPS</button></div>`
  );
  h += getSection("Stand & Mother Tree", "",
    getSelectHtml('germ_icfre_standType', 'Stand Type', STAND_TYPES) +
    getInputHtml('germ_icfre_motherTreeId', 'Mother Tree ID', 'e.g. MT-042') +
    getInputHtml('germ_icfre_treeCount', 'No. of Trees Sampled', 'e.g. 15', 'number') +
    getInputHtml('germ_icfre_treeAge', 'Est. Tree Age (yrs)', 'e.g. 35', 'number') +
    getInputHtml('germ_icfre_treeDiameter', 'DBH (cm)', 'Diameter at breast height', 'number') +
    getInputHtml('germ_icfre_treeHeight', 'Tree Height (m)', 'e.g. 18', 'number')
  );
  h += getSection("Seed Details & Processing", "",
    getSelectHtml('germ_icfre_maturityStage', 'Maturity Stage', MATURITY_STAGES) +
    getInputHtml('germ_icfre_phenologicalState', 'Phenological State', 'e.g. Full flowering') +
    getInputHtml('germ_icfre_seedQuantityKg', 'Quantity (kg)', 'e.g. 2.5', 'number', '0.01') +
    getInputHtml('germ_icfre_seedQuantityUnits', 'Quantity (units/count)', 'e.g. 500 seeds') +
    getInputHtml('germ_icfre_processingDate', 'Processing Date', '', 'date') +
    getInputHtml('germ_icfre_packagingType', 'Packaging Type', 'e.g. Cloth bag')
  );
  h += getSection("Remarks", "", getTextareaHtml('germ_icfre_remarks', 'Field Notes / Observations', 'Habitat, associated species...', 3));
  return h;
}

function renderNBPGR() {
  let h = getSection("Accession Passport Data", "",
    getInputHtml('germ_nbpgr_speciesScientific', 'Scientific Name *', 'e.g. Shorea robusta', 'text', '', true) +
    getInputHtml('germ_nbpgr_speciesCommon', 'Common Name', 'e.g. Sal') +
    getInputHtml('germ_nbpgr_family', 'Family', 'e.g. Dipterocarpaceae') +
    getInputHtml('germ_nbpgr_icNumber', 'IC Number', 'IC-XXXXXX', 'text', '', false, 'Indigenous Collection No.') +
    getInputHtml('germ_nbpgr_accessionNo', 'Accession Number', 'Accession / Genebank No.') +
    getSelectHtml('germ_nbpgr_biologicalStatus', 'Biological Status', NBPGR_BIO_STATUS) +
    getInputHtml('germ_nbpgr_pedigree', 'Pedigree / Lineage', 'Parent lines', 'text', '', true) +
    getInputHtml('germ_nbpgr_uniqueTrait', 'Unique Trait', 'e.g. drought tolerant', 'text', '', true)
  );
  h += getSection("Acquisition Details", "",
    getSelectHtml('germ_nbpgr_acquisitionMode', 'Mode of Acquisition', NBPGR_ACQUISITION) +
    getInputHtml('germ_nbpgr_acquisitionDate', 'Acquisition Date', '', 'date') +
    getInputHtml('germ_nbpgr_donorName', 'Donor Name', 'Individual / Organisation') +
    getInputHtml('germ_nbpgr_donorInstitution', 'Donor Institution', 'e.g. FRI, IFGTB') +
    getSelectHtml('germ_nbpgr_materialTransferAgreement', 'Material Transfer Agreement', ["MTA in place","MTA not required","Pending","Exempt"], 'Select...', false, 'Required for exotic germplasm') +
    getSelectHtml('germ_nbpgr_repatriationStatus', 'Repatriation Status', ["Not applicable","Pending","Completed","Under review"])
  );
  h += getSection("Collection Origin", "",
    getInputHtml('germ_nbpgr_collectionCountry', 'Country of Origin', 'India') +
    getInputHtml('germ_nbpgr_collectionState', 'State', 'e.g. Odisha') +
    getInputHtml('germ_nbpgr_collectionDistrict', 'District', 'District') +
    getInputHtml('germ_nbpgr_latitude', 'Latitude', 'e.g. 20.9374', 'number', '0.000001') +
    getInputHtml('germ_nbpgr_longitude', 'Longitude', 'e.g. 85.0985', 'number', '0.000001') +
    getInputHtml('germ_nbpgr_altitude', 'Altitude (m asl)', 'e.g. 450', 'number') + 
    // FIX #3: Unique ID — distinct from ICFRE GPS button.
    `<div class="form-group" style="flex:0 0 auto; align-self:flex-end;"><button type="button" class="btn btn-accent gps-fill-btn" id="btnGermNBPGRGPS">Auto GPS</button></div>`
  );
  h += getSection("Seed / Material Properties", "",
    getSelectHtml('germ_nbpgr_storageType', 'Storage Behaviour', NBPGR_STORAGE_TYPES, 'Select...', false, 'Determines conservation strategy') +
    getInputHtml('germ_nbpgr_seedWeight1000', '1000-Seed Weight (g)', 'e.g. 35.2', 'number', '0.01') +
    getInputHtml('germ_nbpgr_viabilityInitial', 'Initial Viability (%)', 'e.g. 92', 'number') +
    getInputHtml('germ_nbpgr_viabilityCheckDate', 'Viability Check Date', '', 'date')
  );
  h += getSection("Drying Protocol", "",
    getInputHtml('germ_nbpgr_dryingMethod', 'Drying Method', 'e.g. Silica gel', 'text', '', true) +
    getInputHtml('germ_nbpgr_dryingRH', 'Target RH (%)', '15', 'number', '', false, 'NBPGR std: 15%') +
    getInputHtml('germ_nbpgr_dryingTemp', 'Drying Temp. (°C)', '15', 'number', '', false, 'NBPGR std: 15°C') +
    getInputHtml('germ_nbpgr_moistureContent', 'Moisture Content (%)', 'e.g. 6.2', 'number', '0.1')
  );
  h += getSection("Storage Conditions", "",
    getSelectHtml('germ_nbpgr_storageCondition', 'Storage Condition', NBPGR_STORAGE_CONDITIONS, 'Select...', true, 'Base: −18 to −20°C | Active: 4°C') +
    getInputHtml('germ_nbpgr_containerType', 'Container Type', 'e.g. foil pouch') +
    getInputHtml('germ_nbpgr_packagingType', 'Packaging Type', 'e.g. Vacuum-sealed')
  );
  h += getSection("Plant Quarantine & Seed Health", "",
    getSelectHtml('germ_nbpgr_healthStatus', 'Health Status', ["Healthy – Passed quarantine","Minor surface contamination","Pathogen detected","Quarantine hold","Rejected"], 'Select...', true) +
    getInputHtml('germ_nbpgr_quarantineStatus', 'Quarantine Clearance No.', 'Clearance cert') +
    getTextareaHtml('germ_nbpgr_pestReport', 'Pest / Pathogen Report', 'Pathogens found...', 2, false)
  );
  h += getSection("Remarks", "", getTextareaHtml('germ_nbpgr_remarks', 'Additional Notes', 'Conservation priority...', 3));
  return h;
}

function renderISTA() {
  let h = getSection("Seed Lot Identification", "",
    getInputHtml('germ_ista_speciesScientific', 'Scientific Name *', 'e.g. Dalbergia sissoo', 'text', '', true) +
    getInputHtml('germ_ista_speciesCommon', 'Common Name', 'e.g. Shisham') +
    getInputHtml('germ_ista_family', 'Family', 'e.g. Fabaceae') +
    getInputHtml('germ_ista_seedLotNo', 'Seed Lot No.', 'SL-YYYY-XXXX', 'text', '', false, 'Unique identifier') +
    getInputHtml('germ_ista_lotSizeKg', 'Lot Size (kg)', 'e.g. 50', 'number', '0.01') +
    getInputHtml('germ_ista_sampleSizeG', 'Working Sample Size (g)', 'e.g. 25', 'number', '0.1')
  );
  h += getSection("Certificate & Testing Lab", "",
    getSelectHtml('germ_ista_certType', 'Certificate Type', ISTA_CERT_TYPES, 'Select...', true) +
    getInputHtml('germ_ista_submittingLab', 'Submitting Laboratory', 'Lab name') +
    getInputHtml('germ_ista_testingLab', 'Testing Laboratory', 'ISTA-accredited lab name') +
    getInputHtml('germ_ista_samplingOfficer', 'Sampling Officer', 'Name & auth no.') +
    getInputHtml('germ_ista_samplingDate', 'Sampling Date', '', 'date') +
    getInputHtml('germ_ista_validityPeriod', 'Certificate Validity Period', 'e.g. 6 months')
  );
  h += getSection("Seed Origin (OECD)", "",
    getInputHtml('germ_ista_originCountry', 'Country of Origin', 'India') +
    getInputHtml('germ_ista_originState', 'State / Province', 'e.g. Karnataka') +
    getInputHtml('germ_ista_originSeedZone', 'OECD Seed Zone', 'e.g. Southern Dry Deccan') +
    getSelectHtml('germ_ista_oecdCategory', 'OECD Category', ["Source-Identified","Selected","Qualified","Tested"]) +
    getInputHtml('germ_ista_oecdCertNo', 'OECD Certificate No.', 'OECD-IN-XXXX') +
    getInputHtml('germ_ista_oecdApprovedStand', 'Approved Stand', 'Registered stand ID')
  );
  h += getSection("Purity Analysis", "",
    getInputHtml('germ_ista_pureSeedPct', 'Pure Seed (%)', 'e.g. 95.2', 'number', '0.01', false, '% by weight') +
    getInputHtml('germ_ista_inertMatterPct', 'Inert Matter (%)', 'e.g. 3.8', 'number', '0.01') +
    getInputHtml('germ_ista_otherCropPct', 'Other Crop Seeds (%)', 'e.g. 0.5', 'number', '0.01') +
    getInputHtml('germ_ista_weedSeedPct', 'Weed Seeds (%)', 'e.g. 0.5', 'number', '0.01')
  );
  h += getSection("Germination Test", "",
    getSelectHtml('germ_ista_germSubstrate', 'Substrate', ISTA_GERM_SUBSTRATE) +
    getInputHtml('germ_ista_germTemp', 'Temperature (°C)', 'e.g. 20/30 alt') +
    getInputHtml('germ_ista_germDuration', 'Duration (days)', 'e.g. 28', 'number') +
    getInputHtml('germ_ista_germNormalPct', 'Normal Germination (%)', 'e.g. 78', 'number', '0.1') +
    getInputHtml('germ_ista_germAbnormalPct', 'Abnormal Seedlings (%)', 'e.g. 5', 'number', '0.1') +
    getInputHtml('germ_ista_freshUngermPct', 'Fresh / Ungerminated (%)', 'e.g. 12', 'number', '0.1') +
    getInputHtml('germ_ista_hardSeedPct', 'Hard Seeds (%)', 'e.g. 5', 'number', '0.1') +
    getSelectHtml('germ_ista_dormancyType', 'Dormancy Type', ISTA_DORMANCY) +
    getInputHtml('germ_ista_dormancyTreatment', 'Dormancy Treatment', 'e.g. Scarification', 'text', '', true)
  );
  h += getSection("Moisture Content", "",
    getInputHtml('germ_ista_moistureContent', 'Moisture Content (%)', 'e.g. 8.4', 'number', '0.1') +
    getSelectHtml('germ_ista_moistureMethod', 'Testing Method', ["Low-constant temp oven","High-constant temp oven","Karl Fischer titration","Capacitance meter"])
  );
  h += getSection("1000-Seed Weight & Vigour", "",
    getInputHtml('germ_ista_weight1000Seed', '1000-Seed Weight (g)', 'e.g. 42.5', 'number', '0.01') +
    getSelectHtml('germ_ista_vigourTest', 'Vigour Test Used', ["None","Accelerated Ageing","Controlled Deterioration","TZ (Tetrazolium)","Electrical Conductivity","Cold Test"]) +
    getInputHtml('germ_ista_vigourResult', 'Vigour Result', 'e.g. TZ viability 85%', 'text', '', true)
  );
  h += getSection("Seed Health Testing", "",
    getInputHtml('germ_ista_healthTests', 'Tests Conducted', 'e.g. Blotter, Agar plate', 'text', '', true) +
    getTextareaHtml('germ_ista_pathogensFound', 'Pathogens / Organisms', 'Species name...', 2, true)
  );
  h += getSection("Remarks", "", getTextareaHtml('germ_ista_remarks', 'Additional Notes', 'Deviations...', 3));
  return h;
}

// ─── LOGIC ────────────────────────────────────────────────────────
export function init() {
  renderHome();
}

/**
 * Called by main.js every time the screenGermplasm screen is activated.
 * Always starts from the home view for clean system-navigation behaviour.
 */
export function onScreenEnter() {
  currentView = 'home';
  currentBody = null;
  renderHome();
}

function handleAutoGPS() {
  if (curPos.lat) {
    if ($('#germ_icfre_latitude')) $('#germ_icfre_latitude').value = curPos.lat.toFixed(6);
    if ($('#germ_icfre_longitude')) $('#germ_icfre_longitude').value = curPos.lng.toFixed(6);
    if ($('#germ_icfre_altitude') && curPos.alt) $('#germ_icfre_altitude').value = Math.round(curPos.alt);
    if ($('#germ_nbpgr_latitude')) $('#germ_nbpgr_latitude').value = curPos.lat.toFixed(6);
    if ($('#germ_nbpgr_longitude')) $('#germ_nbpgr_longitude').value = curPos.lng.toFixed(6);
    if ($('#germ_nbpgr_altitude') && curPos.alt) $('#germ_nbpgr_altitude').value = Math.round(curPos.alt);
    toast('GPS coordinates filled');
  } else {
    toast('No GPS signal — enter coordinates manually', true);
  }
}

function getHeaderHtml(title) {
  return `
    <div class="screen-header">
      <h2>${title}</h2>
    </div>
    <div class="active-survey-bar">
       <span class="active-label">Active:</span>
       <span class="active-name" id="germTopSurveyName">No survey</span>
    </div>
  `;
}

export async function refreshGermplasmUI() {
  const mount = $('#germplasmMount');
  if (!mount) return;

  // Home view — no survey needed
  if (currentView === 'home') {
    // FIX #2: await renderHome so DOM is fully settled before callers/tests proceed.
    await renderHome();
    return;
  }

  // Form view — render immediately, survey only needed at save time
  if (currentView === 'form' && currentBody) {
    const b = BODIES[currentBody];
    let fieldsHtml = '';
    if (currentBody === 'icfre') fieldsHtml = renderICFRE();
    if (currentBody === 'nbpgr') fieldsHtml = renderNBPGR();
    if (currentBody === 'ista') fieldsHtml = renderISTA();

    mount.innerHTML = getHeaderHtml(`New Record &nbsp;<span style="font-weight:400;font-size:0.8em;opacity:0.7;">${b.name}</span>`) + `
      <div style="padding:var(--sp-md);">
        ${fieldsHtml}
        <button id="btnGSaveRec" class="btn btn-primary btn-block mt-md">Save Record</button>
      </div>
    `;

    // Update active survey name if available
    Store.getActive().then(s => {
      if (s && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = s.name;
    });

    // FIX #3: Bind each GPS button by its unique ID.
    if ($('#btnGermICFREGPS')) $('#btnGermICFREGPS').addEventListener('click', handleAutoGPS);
    if ($('#btnGermNBPGRGPS')) $('#btnGermNBPGRGPS').addEventListener('click', handleAutoGPS);
    // The 'btnGCancelRec' button was removed; users rely on the system back button.

    // Auto-fill today's date
    const isoDate = new Date().toISOString().split('T')[0];
    if ($('#germ_icfre_collectionDate')) $('#germ_icfre_collectionDate').value = isoDate;
    if ($('#germ_nbpgr_acquisitionDate')) $('#germ_nbpgr_acquisitionDate').value = isoDate;
    if ($('#germ_ista_samplingDate')) $('#germ_ista_samplingDate').value = isoDate;

    // Save listener
    const saveBtn = document.getElementById('btnGSaveRec');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        console.log('germplasm.js: SAVE BTN CLICKED!');
        try {
          const spc = $('#germ_' + currentBody + '_speciesScientific').value.trim();
          console.log('species extracted:', spc);
          if (!spc) { toast('Scientific name is required.', true); return; }

          const sv = await Store.getActive();
          if (!sv) { toast('No active survey — select one in the Tools tab.', true); return; }

          const keys = currentBody === 'icfre' ? emptyICFRE : currentBody === 'nbpgr' ? emptyNBPGR : emptyISTA;
          const rec = { id: Date.now(), bodyId: currentBody };
          keys.forEach(k => {
            const el = $('#germ_' + currentBody + '_' + k);
            rec[k] = el ? el.value : '';
          });

          sv.germplasm = sv.germplasm || [];
          sv.germplasm.unshift(rec);
          await Store.update(sv);

          toast('Record saved!');
          currentView = 'list';
          await refreshGermplasmUI();
        } catch (e) {
          console.error(e);
          toast('Error saving record.', true);
        }
      });
      console.log('germplasm.js: ATTACHED save listener to btnGSaveRec');
    } else {
      console.log('germplasm.js: NO saveBtn found to attach to!');
    }
    return;
  }

  // List view — needs active survey
  const s = await Store.getActive();
  if (!s) {
    mount.innerHTML = getHeaderHtml('Germplasm <span>Registry</span>') + `
      <div style="padding:var(--sp-xl); text-align:center; color:var(--text-muted);">
        
        <p>No active survey selected.</p>
        <p style="font-size:0.85rem;">Go to <strong>Tools</strong> and select or create a survey first.</p>
        <button class="btn btn-primary mt-md" id="btnGGoTools">Go to Tools</button>
      </div>
    `;
    document.getElementById('btnGGoTools').addEventListener('click', () => switchScreen('screenToolbar'));
    return;
  }
  const records = s.germplasm || [];

  if (currentView === 'list') {
    let ht = getHeaderHtml('Germplasm <span>Registry</span>');
    ht += `
      <div style="padding: 0 var(--sp-md);">
        <div class="settings-tabs settings-tabs-custom" style="margin-bottom: var(--sp-md);">
          <button class="btn btn-sm settings-tab active btn-g-filter" data-b="all">All (${records.length})</button>
          ${Object.keys(BODIES).map(k => `<button class="btn btn-sm btn-ghost settings-tab btn-g-filter" data-b="${k}">${BODIES[k].icon} ${BODIES[k].name}</button>`).join('')}
        </div>
        <div class="form-row" style="margin-bottom: var(--sp-md);">
           <button class="btn btn-ghost" id="btnGNavHome" style="flex:1; border:1px solid var(--border);">Rules / Forms</button>
           <button class="btn btn-primary" style="flex:1;">Records (${records.length})</button>
        </div>
        <div id="germListCont" style="padding-bottom: 20px;"></div>
      </div>
    `;
    mount.innerHTML = ht;
    if (s.name && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = s.name;

    // FIX #2: await so body cards are in DOM before any test waitForSelector.
    document.getElementById('btnGNavHome').addEventListener('click', async () => { currentView = 'home'; await refreshGermplasmUI(); });

    const applyFilter = (fBody) => {
      $$('.btn-g-filter').forEach(b => {
        const isSel = (b.dataset.b === fBody);
        if (isSel) { b.classList.add('btn-primary', 'active'); b.classList.remove('btn-ghost'); }
        else { b.classList.add('btn-ghost'); b.classList.remove('btn-primary', 'active'); }
      });
      
      const filtered = fBody === 'all' ? records : records.filter(r => r.bodyId === fBody);
      const cont = $('#germListCont');
      
      if (filtered.length === 0) {
        cont.innerHTML = `
          <div class="empty-state" style="padding:var(--sp-xl) 0;text-align:center;color:var(--text-muted);background:var(--bg-deep);border-radius:var(--radius-md);">
            
            <div>No ${fBody === 'all' ? '' : BODIES[fBody].name} records found yet</div>
            <button class="btn btn-primary mt-md" id="btnGNewFirst">Add Record</button>
          </div>
        `;
        $('#btnGNewFirst')?.addEventListener('click', () => { currentView = 'home'; refreshGermplasmUI(); });
      } else {
        cont.innerHTML = filtered.map(r => {
          const body = BODIES[r.bodyId];
          return `
            <div class="form-card" style="position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; gap:var(--sp-md); align-items:center;">
                  <div style="width:40px; height:40px;">${body.icon}</div>
                  <div>
                    <div class="g-card-meta">${body.name}</div>
                    <div style="font-size:1.05rem; color:var(--text-primary); font-weight:700; font-style:italic;">${r.speciesScientific || '—'}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${r.speciesCommon || ''}</div>
                  </div>
                </div>
                <button class="btn-ghost btn-g-del" data-id="${r.id}" style="color:var(--red); padding:4px;">✕</button>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:12px; display:flex; gap:12px; flex-wrap:wrap; font-weight:500;">
                ${r.collectionDate||r.acquisitionDate||r.samplingDate ? `<span>${r.collectionDate||r.acquisitionDate||r.samplingDate}</span>` : ''}
                ${r.district||r.collectionDistrict ? `<span>${r.district||r.collectionDistrict}</span>` : ''}
                ${r.collectorName||r.samplingOfficer ? `<span>${r.collectorName||r.samplingOfficer}</span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        $$('.btn-g-del').forEach(b => {
          b.addEventListener('click', async () => {
            if (await fcConfirm('Delete this germplasm record?')) {
              const sv = await Store.getActive();
              sv.germplasm = sv.germplasm.filter(x => x.id != b.dataset.id);
              await Store.update(sv);
              refreshGermplasmUI();
            }
          });
        });
      }
    };

    $$('.btn-g-filter').forEach(b => b.addEventListener('click', () => applyFilter(b.dataset.b)));
    applyFilter('all');
  }
}

/**
 * FIX #2: renderHome is now async and awaits Store.getActive() directly.
 * This eliminates the race condition where DOM was populated asynchronously
 * in an unawaited .then(), causing Puppeteer waitForSelector to fire before
 * body cards existed. All callers must await this function.
 */
async function renderHome() {
  const mount = $('#germplasmMount');
  if (!mount) return;
  const sv = await Store.getActive();
  const rc = sv ? (sv.germplasm ? sv.germplasm.length : 0) : 0;
  let bHtml = Object.keys(BODIES).map(k => {
    const b = BODIES[k];
    return `
      <div class="form-card g-body-card" data-b="${k}">
        <div style="display:flex; align-items:flex-start; gap:var(--sp-lg);">
          <div class="g-icon-large" style="width:60px; height:60px; flex-shrink:0;">${b.icon}</div>
          <div style="flex:1;">
            <h3 class="card-title" style="margin-bottom:4px;">${b.name} <span class="badge">${b.focus}</span></h3>
            <div class="g-card-meta">${b.full}</div>
            <div class="card-desc" style="margin-bottom:0;">${b.desc}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  mount.innerHTML = getHeaderHtml('Germplasm <span>Collector</span>') + `
    <div style="padding:var(--sp-md);">
      <div class="form-row" style="margin-bottom:var(--sp-md);">
         <button class="btn btn-primary" id="btnGNavHome" style="flex:1;">Rules / Forms</button>
         <button class="btn btn-ghost" id="btnGNavList" style="flex:1; border:1px solid var(--border);">Saved Records (${rc})</button>
      </div>
      <p class="card-desc" style="text-align:center; margin-bottom:var(--sp-md);">Select a regulatory body to add new germplasm material:</p>
      ${bHtml}
    </div>
  `;

  if (sv && sv.name && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = sv.name;

  // FIX #2: All event listeners wired after DOM is synchronously injected.
  document.getElementById('btnGNavList').addEventListener('click', async () => { currentView = 'list'; await refreshGermplasmUI(); });

  $$('.g-body-card').forEach(c => {
    c.addEventListener('click', async () => {
      currentBody = c.dataset.b;
      currentView = 'form';
      await refreshGermplasmUI();
    });
  });
}


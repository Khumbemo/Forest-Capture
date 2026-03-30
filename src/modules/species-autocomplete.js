/**
 * species-autocomplete.js — Forest Capture v3.0
 * Local taxonomy autocomplete for species name fields in Quadrat and
 * Transect entry forms.
 */

const _learnedSpecies = new Map(); // scientific name → entry object

export function loadSurveyHistory(surveys) {
  for (const survey of (surveys || [])) {
    for (const quadrat of (survey.quadrats || [])) {
      for (const sp of (quadrat.species || [])) {
        _addLearnedEntry(sp);
      }
    }
    for (const transect of (survey.transects || [])) {
      for (const sp of (transect.intercepts || [])) {
        _addLearnedEntry(sp);
      }
    }
  }
}

function _addLearnedEntry(sp) {
  if (!sp?.name) return;
  const key = sp.name.toLowerCase().trim();
  _learnedSpecies.set(key, {
    scientific: sp.name,
    common:     sp.common  || '',
    family:     sp.family      || '',
    genus:      sp.genus       || sp.name.split(' ')[0] || '',
    source:     'history',
    count:      (_learnedSpecies.get(key)?.count || 0) + 1,
  });
}

export function attachAutocomplete(inputId, options = {}) {
  const input = document.getElementById(inputId);
  if (!input) {
    console.warn(\`[autocomplete] Element #\${inputId} not found.\`);
    return;
  }

  const { onSelect = () => {}, maxResults = 8 } = options;

  // Create the dropdown.
  const dropdown = _createDropdown(inputId);
  input.parentElement.style.position = 'relative';
  input.insertAdjacentElement('afterend', dropdown);

  let _activeIndex = -1;
  let _currentResults = [];

  // ── Input handler ─────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query.length < 2) { _hide(dropdown); return; }

    _currentResults = _search(query, maxResults);
    if (_currentResults.length === 0) { _hide(dropdown); return; }

    _activeIndex = -1;
    _render(dropdown, _currentResults, _activeIndex, (entry) => {
      _select(input, entry, dropdown, onSelect);
    });
    _show(dropdown);
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────
  input.addEventListener('keydown', (e) => {
    if (!_isVisible(dropdown)) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIndex = Math.min(_activeIndex + 1, _currentResults.length - 1);
      _render(dropdown, _currentResults, _activeIndex, (entry) => {
        _select(input, entry, dropdown, onSelect);
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIndex = Math.max(_activeIndex - 1, -1);
      _render(dropdown, _currentResults, _activeIndex, (entry) => {
        _select(input, entry, dropdown, onSelect);
      });
    } else if (e.key === 'Enter' && _activeIndex >= 0) {
      e.preventDefault();
      _select(input, _currentResults[_activeIndex], dropdown, onSelect);
    } else if (e.key === 'Escape') {
      _hide(dropdown);
    }
  });

  // Hide on outside click.
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      _hide(dropdown);
    }
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

function _search(query, max) {
  const q       = query.toLowerCase().trim();
  const results = [];
  const seen    = new Set();

  // Priority 1: researcher's own learned species (sorted by frequency)
  const learned = [..._learnedSpecies.values()]
    .filter(e => _matches(e, q))
    .sort((a, b) => b.count - a.count);

  for (const entry of learned) {
    if (results.length >= max) break;
    const key = entry.scientific.toLowerCase();
    if (!seen.has(key)) { seen.add(key); results.push({ ...entry, source: 'history' }); }
  }

  // Priority 2: built-in dictionary
  for (const entry of SPECIES_DICTIONARY) {
    if (results.length >= max) break;
    if (!_matches(entry, q)) continue;
    const key = entry.scientific.toLowerCase();
    if (!seen.has(key)) { seen.add(key); results.push(entry); }
  }

  return results;
}

function _matches(entry, q) {
  return entry.scientific?.toLowerCase().includes(q)
      || entry.common?.toLowerCase().includes(q)
      || entry.family?.toLowerCase().includes(q);
}

// ─── Dropdown rendering ───────────────────────────────────────────────────────

function _createDropdown(inputId) {
  const el = document.createElement('ul');
  el.id        = \`autocomplete-\${inputId}\`;
  el.className = 'species-dropdown';
  el.setAttribute('role', 'listbox');
  el.style.display = 'none';
  return el;
}

function _render(dropdown, results, activeIndex, onSelect) {
  dropdown.innerHTML = '';
  results.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className  = \`species-option\${i === activeIndex ? ' species-option--active' : ''}\`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');

    const badge = entry.source === 'history'
      ? \`<span class="species-badge-history">used</span>\`
      : '';

    li.innerHTML = \`
      <span class="species-scientific">\${_highlight(entry.scientific, dropdown._query || '')}</span>
      \${entry.common ? \`<span class="species-common">\${escapeHtml(entry.common)}</span>\` : ''}
      \${entry.family ? \`<span class="species-family">\${escapeHtml(entry.family)}</span>\` : ''}
      \${badge}
    \`;

    li.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur before click fires
      onSelect(entry);
    });

    dropdown.appendChild(li);
  });
}

function _select(input, entry, dropdown, onSelect) {
  input.value = entry.scientific;
  _hide(dropdown);
  onSelect(entry);
  // Add to learned history.
  _addLearnedEntry({ name: entry.scientific, common: entry.common,
                     family: entry.family, genus: entry.genus });
}

function _show(el) { el.style.display = 'block'; }
function _hide(el) { el.style.display = 'none';  }
function _isVisible(el) { return el.style.display !== 'none'; }

function _highlight(text, query) {
  if (!query) return escapeHtml(text);
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, i))
    + \`<strong>\${escapeHtml(text.slice(i, i + query.length))}</strong>\`
    + escapeHtml(text.slice(i + query.length));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SPECIES_DICTIONARY = [
  // ── Tropical Asia ──────────────────────────────────────────────────────────
  { scientific: 'Shorea robusta',          common: 'Sal',                   family: 'Dipterocarpaceae', genus: 'Shorea'       },
  { scientific: 'Shorea leprosula',        common: 'Light red meranti',     family: 'Dipterocarpaceae', genus: 'Shorea'       },
  { scientific: 'Dipterocarpus turbinatus',common: 'Gurjun',                family: 'Dipterocarpaceae', genus: 'Dipterocarpus'},
  { scientific: 'Tectona grandis',         common: 'Teak',                  family: 'Lamiaceae',        genus: 'Tectona'      },
  { scientific: 'Dalbergia sissoo',        common: 'Indian rosewood',       family: 'Fabaceae',         genus: 'Dalbergia'    },
  { scientific: 'Terminalia arjuna',       common: 'Arjun tree',            family: 'Combretaceae',     genus: 'Terminalia'   },
  { scientific: 'Terminalia bellirica',    common: 'Bahera',                family: 'Combretaceae',     genus: 'Terminalia'   },
  { scientific: 'Terminalia chebula',      common: 'Black myrobalan',       family: 'Combretaceae',     genus: 'Terminalia'   },
  { scientific: 'Swietenia macrophylla',   common: 'Big-leaf mahogany',     family: 'Meliaceae',        genus: 'Swietenia'    },
  { scientific: 'Toona ciliata',           common: 'Indian toon',           family: 'Meliaceae',        genus: 'Toona'        },
  { scientific: 'Michelia champaca',       common: 'Champak',               family: 'Magnoliaceae',     genus: 'Michelia'     },
  { scientific: 'Magnolia grandiflora',    common: 'Southern magnolia',     family: 'Magnoliaceae',     genus: 'Magnolia'     },
  { scientific: 'Ficus benghalensis',      common: 'Banyan',                family: 'Moraceae',         genus: 'Ficus'        },
  { scientific: 'Ficus religiosa',         common: 'Peepal / Bo tree',      family: 'Moraceae',         genus: 'Ficus'        },
  { scientific: 'Ficus racemosa',          common: 'Cluster fig',           family: 'Moraceae',         genus: 'Ficus'        },
  { scientific: 'Aegle marmelos',          common: 'Bael',                  family: 'Rutaceae',         genus: 'Aegle'        },
  { scientific: 'Syzygium cumini',         common: 'Java plum',             family: 'Myrtaceae',        genus: 'Syzygium'     },
  { scientific: 'Syzygium jambos',         common: 'Rose apple',            family: 'Myrtaceae',        genus: 'Syzygium'     },
  { scientific: 'Bombax ceiba',            common: 'Red silk-cotton',       family: 'Malvaceae',        genus: 'Bombax'       },
  { scientific: 'Ceiba pentandra',         common: 'Kapok',                 family: 'Malvaceae',        genus: 'Ceiba'        },
  { scientific: 'Mangifera indica',        common: 'Mango',                 family: 'Anacardiaceae',    genus: 'Mangifera'    },
  { scientific: 'Artocarpus heterophyllus',common: 'Jackfruit',             family: 'Moraceae',         genus: 'Artocarpus'   },
  { scientific: 'Artocarpus lakoocha',     common: 'Monkey jack',           family: 'Moraceae',         genus: 'Artocarpus'   },
  { scientific: 'Azadirachta indica',      common: 'Neem',                  family: 'Meliaceae',        genus: 'Azadirachta'  },
  { scientific: 'Melia azedarach',         common: 'Chinaberry',            family: 'Meliaceae',        genus: 'Melia'        },
  { scientific: 'Albizia lebbeck',         common: 'Woman\'s tongue',       family: 'Fabaceae',         genus: 'Albizia'      },
  { scientific: 'Albizia procera',         common: 'White siris',           family: 'Fabaceae',         genus: 'Albizia'      },
  { scientific: 'Albizia odoratissima',    common: 'Black siris',           family: 'Fabaceae',         genus: 'Albizia'      },
  { scientific: 'Acacia catechu',          common: 'Catechu',               family: 'Fabaceae',         genus: 'Acacia'       },
  { scientific: 'Acacia nilotica',         common: 'Gum arabic tree',       family: 'Fabaceae',         genus: 'Acacia'       },
  { scientific: 'Bauhinia variegata',      common: 'Mountain ebony',        family: 'Fabaceae',         genus: 'Bauhinia'     },
  { scientific: 'Butea monosperma',        common: 'Flame of the forest',   family: 'Fabaceae',         genus: 'Butea'        },
  { scientific: 'Pterocarpus marsupium',   common: 'Indian kino tree',      family: 'Fabaceae',         genus: 'Pterocarpus'  },
  { scientific: 'Pterocarpus santalinus',  common: 'Red sandalwood',        family: 'Fabaceae',         genus: 'Pterocarpus'  },
  { scientific: 'Santalum album',          common: 'Indian sandalwood',     family: 'Santalaceae',      genus: 'Santalum'     },
  { scientific: 'Gmelina arborea',         common: 'Gamhar',                family: 'Lamiaceae',        genus: 'Gmelina'      },
  { scientific: 'Lagerstroemia speciosa',  common: 'Pride of India',        family: 'Lythraceae',       genus: 'Lagerstroemia'},
  { scientific: 'Calophyllum inophyllum',  common: 'Alexandrian laurel',    family: 'Calophyllaceae',   genus: 'Calophyllum'  },
  { scientific: 'Mallotus philippensis',   common: 'Kamala tree',           family: 'Euphorbiaceae',    genus: 'Mallotus'     },
  { scientific: 'Emblica officinalis',     common: 'Indian gooseberry',     family: 'Phyllanthaceae',   genus: 'Emblica'      },

  // ── Temperate — North America ──────────────────────────────────────────────
  { scientific: 'Quercus alba',            common: 'White oak',             family: 'Fagaceae',         genus: 'Quercus'      },
  { scientific: 'Quercus robur',           common: 'English oak',           family: 'Fagaceae',         genus: 'Quercus'      },
  { scientific: 'Quercus rubra',           common: 'Northern red oak',      family: 'Fagaceae',         genus: 'Quercus'      },
  { scientific: 'Quercus petraea',         common: 'Sessile oak',           family: 'Fagaceae',         genus: 'Quercus'      },
  { scientific: 'Quercus velutina',        common: 'Black oak',             family: 'Fagaceae',         genus: 'Quercus'      },
  { scientific: 'Fagus sylvatica',         common: 'European beech',        family: 'Fagaceae',         genus: 'Fagus'        },
  { scientific: 'Fagus grandifolia',       common: 'American beech',        family: 'Fagaceae',         genus: 'Fagus'        },
  { scientific: 'Acer saccharum',          common: 'Sugar maple',           family: 'Sapindaceae',      genus: 'Acer'         },
  { scientific: 'Acer rubrum',             common: 'Red maple',             family: 'Sapindaceae',      genus: 'Acer'         },
  { scientific: 'Acer platanoides',        common: 'Norway maple',          family: 'Sapindaceae',      genus: 'Acer'         },
  { scientific: 'Acer campestre',          common: 'Field maple',           family: 'Sapindaceae',      genus: 'Acer'         },
  { scientific: 'Betula pendula',          common: 'Silver birch',          family: 'Betulaceae',       genus: 'Betula'       },
  { scientific: 'Betula papyrifera',       common: 'Paper birch',           family: 'Betulaceae',       genus: 'Betula'       },
  { scientific: 'Betula pubescens',        common: 'Downy birch',           family: 'Betulaceae',       genus: 'Betula'       },
  { scientific: 'Alnus glutinosa',         common: 'Common alder',          family: 'Betulaceae',       genus: 'Alnus'        },
  { scientific: 'Carpinus betulus',        common: 'European hornbeam',     family: 'Betulaceae',       genus: 'Carpinus'     },
  { scientific: 'Corylus avellana',        common: 'Hazel',                 family: 'Betulaceae',       genus: 'Corylus'      },
  { scientific: 'Fraxinus excelsior',      common: 'European ash',          family: 'Oleaceae',         genus: 'Fraxinus'     },
  { scientific: 'Fraxinus americana',      common: 'White ash',             family: 'Oleaceae',         genus: 'Fraxinus'     },
  { scientific: 'Ulmus procera',           common: 'English elm',           family: 'Ulmaceae',         genus: 'Ulmus'        },
  { scientific: 'Ulmus americana',         common: 'American elm',          family: 'Ulmaceae',         genus: 'Ulmus'        },
  { scientific: 'Tilia cordata',           common: 'Small-leaved lime',     family: 'Malvaceae',        genus: 'Tilia'        },
  { scientific: 'Tilia americana',         common: 'American basswood',     family: 'Malvaceae',        genus: 'Tilia'        },
  { scientific: 'Populus tremula',         common: 'European aspen',        family: 'Salicaceae',       genus: 'Populus'      },
  { scientific: 'Populus tremuloides',     common: 'Trembling aspen',       family: 'Salicaceae',       genus: 'Populus'      },
  { scientific: 'Populus nigra',           common: 'Black poplar',          family: 'Salicaceae',       genus: 'Populus'      },
  { scientific: 'Salix alba',              common: 'White willow',          family: 'Salicaceae',       genus: 'Salix'        },
  { scientific: 'Salix fragilis',          common: 'Crack willow',          family: 'Salicaceae',       genus: 'Salix'        },
  { scientific: 'Prunus avium',            common: 'Wild cherry',           family: 'Rosaceae',         genus: 'Prunus'       },
  { scientific: 'Prunus serotina',         common: 'Black cherry',          family: 'Rosaceae',         genus: 'Prunus'       },
  { scientific: 'Malus sylvestris',        common: 'Wild apple',            family: 'Rosaceae',         genus: 'Malus'        },
  { scientific: 'Sorbus aucuparia',        common: 'Rowan',                 family: 'Rosaceae',         genus: 'Sorbus'       },
  { scientific: 'Crataegus monogyna',      common: 'Hawthorn',              family: 'Rosaceae',         genus: 'Crataegus'    },
  { scientific: 'Juglans regia',           common: 'Common walnut',         family: 'Juglandaceae',     genus: 'Juglans'      },
  { scientific: 'Juglans nigra',           common: 'Black walnut',          family: 'Juglandaceae',     genus: 'Juglans'      },
  { scientific: 'Castanea sativa',         common: 'Sweet chestnut',        family: 'Fagaceae',         genus: 'Castanea'     },
  { scientific: 'Liriodendron tulipifera', common: 'Tulip tree',            family: 'Magnoliaceae',     genus: 'Liriodendron' },
  { scientific: 'Liquidambar styraciflua',common: 'American sweetgum',     family: 'Altingiaceae',     genus: 'Liquidambar'  },
  { scientific: 'Nyssa sylvatica',         common: 'Black tupelo',          family: 'Nyssaceae',        genus: 'Nyssa'        },
  { scientific: 'Sassafras albidum',       common: 'Sassafras',             family: 'Lauraceae',        genus: 'Sassafras'    },
  { scientific: 'Platanus occidentalis',   common: 'American sycamore',     family: 'Platanaceae',      genus: 'Platanus'     },
  { scientific: 'Platanus acerifolia',     common: 'London plane',          family: 'Platanaceae',      genus: 'Platanus'     },

  // ── Conifers ───────────────────────────────────────────────────────────────
  { scientific: 'Pinus sylvestris',        common: 'Scots pine',            family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Pinus strobus',           common: 'Eastern white pine',    family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Pinus taeda',             common: 'Loblolly pine',         family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Pinus palustris',         common: 'Longleaf pine',         family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Pinus radiata',           common: 'Monterey pine',         family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Pinus roxburghii',        common: 'Chir pine',             family: 'Pinaceae',         genus: 'Pinus'        },
  { scientific: 'Picea abies',             common: 'Norway spruce',         family: 'Pinaceae',         genus: 'Picea'        },
  { scientific: 'Picea sitchensis',        common: 'Sitka spruce',          family: 'Pinaceae',         genus: 'Picea'        },
  { scientific: 'Abies alba',              common: 'European silver fir',   family: 'Pinaceae',         genus: 'Abies'        },
  { scientific: 'Abies balsamea',          common: 'Balsam fir',            family: 'Pinaceae',         genus: 'Abies'        },
  { scientific: 'Larix decidua',           common: 'European larch',        family: 'Pinaceae',         genus: 'Larix'        },
  { scientific: 'Larix occidentalis',      common: 'Western larch',         family: 'Pinaceae',         genus: 'Larix'        },
  { scientific: 'Cedrus deodara',          common: 'Deodar cedar',          family: 'Pinaceae',         genus: 'Cedrus'       },
  { scientific: 'Cedrus libani',           common: 'Cedar of Lebanon',      family: 'Pinaceae',         genus: 'Cedrus'       },
  { scientific: 'Pseudotsuga menziesii',   common: 'Douglas fir',           family: 'Pinaceae',         genus: 'Pseudotsuga'  },
  { scientific: 'Tsuga canadensis',        common: 'Eastern hemlock',       family: 'Pinaceae',         genus: 'Tsuga'        },
  { scientific: 'Sequoiadendron giganteum',common: 'Giant sequoia',         family: 'Cupressaceae',     genus: 'Sequoiadendron'},
  { scientific: 'Sequoia sempervirens',    common: 'Coast redwood',         family: 'Cupressaceae',     genus: 'Sequoia'      },
  { scientific: 'Cupressus sempervirens',  common: 'Mediterranean cypress', family: 'Cupressaceae',     genus: 'Cupressus'    },
  { scientific: 'Thuja occidentalis',      common: 'Eastern arborvitae',    family: 'Cupressaceae',     genus: 'Thuja'        },
];

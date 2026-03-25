/* Forest Capture v3.0 — Full Ecology Suite */
;(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
let toastT;function toast(m,e){const el=$('#toast');if(!el)return;el.textContent=m;el.classList.toggle('error',!!e);el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),2500);}
// Online/Offline dot
function updateDot(){const d=$('#onlineDot');if(d){navigator.onLine?d.classList.remove('offline'):d.classList.add('offline');}}
window.addEventListener('online',updateDot);window.addEventListener('offline',updateDot);setTimeout(updateDot,500);

// ===== STORAGE =====
const SK='forest_survey_data';
const Store={
  _d(){
    const empty={surveys:[],activeId:null};
    try{
      const raw=localStorage.getItem(SK);
      if(raw==null||raw==='')return empty;
      const d=JSON.parse(raw);
      if(Array.isArray(d)){localStorage.setItem(SK,JSON.stringify(empty));return empty;}
      if(!d||typeof d!=='object'){localStorage.setItem(SK,JSON.stringify(empty));return empty;}
      let fixed=false;
      if(!Array.isArray(d.surveys)){d.surveys=[];fixed=true;}
      if(!('activeId' in d)){d.activeId=null;fixed=true;}
      if(fixed)this._s(d);
      return d;
    }catch(err){localStorage.setItem(SK,JSON.stringify(empty));return empty;}
  },
  _s(d){localStorage.setItem(SK,JSON.stringify(d));},
  getSurveys(){return this._d().surveys;},
  getActive(){const d=this._d();return d.surveys.find(s=>s.id===d.activeId)||null;},
  setActive(id){const d=this._d();d.activeId=id;this._s(d);},
  add(s){const d=this._d();d.surveys.push(s);d.activeId=s.id;this._s(d);},
  update(s){const d=this._d();const i=d.surveys.findIndex(x=>x.id===s.id);if(i>=0)d.surveys[i]=s;this._s(d);},
  del(id){const d=this._d();d.surveys=d.surveys.filter(s=>s.id!==id);if(d.activeId===id)d.activeId=d.surveys.length?d.surveys[0].id:null;this._s(d);}
};

// ===== SPECIES DATABASE (common Indian forest species) =====
const SPECIES_DB=["Shorea robusta","Tectona grandis","Dalbergia sissoo","Acacia catechu","Pinus roxburghii","Cedrus deodara","Quercus leucotrichophora","Rhododendron arboreum","Alnus nepalensis","Schima wallichii","Terminalia tomentosa","Anogeissus latifolia","Diospyros melanoxylon","Madhuca indica","Butea monosperma","Bombax ceiba","Ficus benghalensis","Ficus religiosa","Mangifera indica","Azadirachta indica","Eucalyptus globulus","Dendrocalamus strictus","Bambusa bambos","Lantana camara","Eupatorium adenophorum","Parthenium hysterophorus","Adina cordifolia","Lagerstroemia parviflora","Syzygium cumini","Emblica officinalis"];

// ===== CLOCK =====
function updateClock(){const n=new Date();const ct=$('#clockTime');const cd=$('#clockDate');if(ct)ct.textContent=n.toLocaleTimeString('en-IN',{hour12:false});if(cd)cd.textContent=n.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}
setInterval(updateClock,1000);updateClock();

// ===== SURVEY TIMER =====
let timerInterval=null,timerStart=null,timerRunning=false;
function updateTimerDisplay(){if(!timerStart)return;const s=Math.floor((Date.now()-timerStart)/1000);const m=Math.floor(s/60);const label=`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;const tt=$('#timerText');if(tt)tt.textContent=label;const btn=$('#btnSurveyTimer');if(btn&&timerRunning)btn.textContent=`\u23f1\ufe0f ${label}`;}
const elSurveyTimer=$('#btnSurveyTimer');
if(elSurveyTimer)elSurveyTimer.addEventListener('click',function(){
  if(timerRunning){clearInterval(timerInterval);timerRunning=false;this.textContent='⏱️ Start Timer';toast('Timer stopped');}
  else{timerStart=Date.now();timerInterval=setInterval(updateTimerDisplay,1000);timerRunning=true;this.textContent='⏱️ Stop Timer';toast('Timer started');}
});

// ===== GPS =====
let curPos={lat:null,lng:null,alt:null,acc:null},gpsWatchId=null;
function toUTM(lat,lng){const z=Math.floor((lng+180)/6)+1;const cm=(z-1)*6-180+3;const k0=0.9996;const e=0.00669438;const ep2=e/(1-e);const n2=6378137/Math.sqrt(1-e*Math.sin(lat*Math.PI/180)**2);const t=Math.tan(lat*Math.PI/180);const c=ep2*Math.cos(lat*Math.PI/180)**2;const a2=(lng-cm)*Math.PI/180*Math.cos(lat*Math.PI/180);const lr=lat*Math.PI/180;const m=6378137*((1-e/4-3*e*e/64)*lr-(3*e/8+3*e*e/32)*Math.sin(2*lr)+(15*e*e/256)*Math.sin(4*lr));let x=k0*n2*(a2+a2**3/6*(1-t**2+c))+500000;let y=k0*(m+n2*Math.tan(lr)*a2**2/2);if(lat<0)y+=10000000;return{zone:z,easting:Math.round(x),northing:Math.round(y)};}
function fmtCoords(lat,lng){
  if(lat==null||lng==null||Number.isNaN(lat)||Number.isNaN(lng))return'—';
  const fmt=$('#settingCoordFormat')?$('#settingCoordFormat').value:'dd';
  if(fmt==='utm'){const u=toUTM(lat,lng);return`${u.zone}${lat>=0?'N':'S'} ${u.easting}mE ${u.northing}mN`;}
  if(fmt==='dms'){
    function toDMS(d,pos,neg){const dir=d>=0?pos:neg;d=Math.abs(d);const deg=Math.floor(d);const m=Math.floor((d-deg)*60);const s=((d-deg)*60-m)*60;return`${deg}°${m}'${s.toFixed(1)}"${dir}`;}
    return toDMS(lat,'N','S')+' '+toDMS(lng,'E','W');
  }
  return`${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

function startGPS(){
  if(!navigator.geolocation){if($('#hudGpsStatus'))$('#hudGpsStatus').textContent='NO API';return;}
  gpsWatchId=navigator.geolocation.watchPosition(p=>{
    curPos.lat=p.coords.latitude;curPos.lng=p.coords.longitude;curPos.alt=p.coords.altitude;curPos.acc=p.coords.accuracy;
    const fmt = fmtCoords(curPos.lat,curPos.lng);
    if($('#teleCoords')) $('#teleCoords').textContent = fmt;
    if($('#teleLocation')) $('#teleLocation').textContent = `±${Math.round(curPos.acc)}m Precision`;
    if($('#teleAlt') && curPos.alt!==null) $('#teleAlt').textContent = `${Math.round(curPos.alt)} m`;
    
    // Update Map HUD
    if($('#hudCoords')) {
      $('#hudCoords').textContent = fmtCoords(curPos.lat,curPos.lng);
      $('#hudAlt').textContent = curPos.alt!==null ? `${Math.round(curPos.alt)} m` : '--- m';
      $('#hudAcc').textContent = curPos.acc ? `±${Math.round(curPos.acc)} m` : '---';
      const u = toUTM(curPos.lat,curPos.lng);
      $('#hudUTM').textContent = `${u.zone}${curPos.lat>=0?'N':'S'}`;
      $('#hudGpsStatus').textContent = 'ACTIVE';
    }

    if(map){if(userMarker)userMarker.setLatLng([curPos.lat,curPos.lng]);}
    fetchWeather(curPos.lat,curPos.lng);
  },e=>{if($('#hudGpsStatus'))$('#hudGpsStatus').textContent='NO SIGNAL';},{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
}

// ===== WEATHER =====
let weatherLastKey='',weatherFetchT=0;
async function fetchWeather(lat,lng){try{
  const key=`${lat.toFixed(3)},${lng.toFixed(3)}`;
  const now=Date.now();
  if(key===weatherLastKey&&now-weatherFetchT<600000)return;
  weatherLastKey=key;weatherFetchT=now;
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
  const d=await r.json();if(!d||!d.current)return;const c=d.current;
  const wm={0:'Clear',1:'Mostly Clear',2:'Partly Cloudy',3:'Overcast',45:'Fog',48:'Rime Fog',51:'Light Drizzle',53:'Drizzle',55:'Dense Drizzle',61:'Light Rain',63:'Rain',65:'Heavy Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',80:'Showers',95:'Thunderstorm'};
  const wi=c.weather_code<=0?'☀️':c.weather_code<=3?'⛅':c.weather_code<=48?'🌫️':c.weather_code<=55?'🌦️':c.weather_code<=65?'🌧️':'⛈️';
  
  if($('#headerWeatherIcon')) $('#headerWeatherIcon').textContent=wi;
  if($('#headerWeatherText')) $('#headerWeatherText').textContent=`${c.temperature_2m}°C`;
  if($('#teleTemp')) $('#teleTemp').textContent=`${c.temperature_2m}°C`;
  if($('#teleWeatherDesc')) $('#teleWeatherDesc').textContent=wm[c.weather_code]||'';
  if($('#teleHumidity')) $('#teleHumidity').textContent=`${c.relative_humidity_2m}%`;
  if($('#teleWind')) $('#teleWind').textContent=`Wind: ${c.wind_speed_10m} km/h`;
}catch(e){}}

// ===== NAVIGATION =====
function switchScreen(id){
  $$('.screen').forEach(s=>s.classList.remove('active'));$$('.nav-btn').forEach(b=>b.classList.remove('active'));$$('.tb-btn[data-screen]').forEach(b=>b.classList.remove('active'));
  const t=document.getElementById(id);if(t){t.classList.add('active');t.style.animation='none';t.offsetHeight;t.style.animation='';}
  const nb=document.querySelector(`.nav-btn[data-screen="${id}"]`);if(nb)nb.classList.add('active');
  const tb=document.querySelector(`.tb-btn[data-screen="${id}"]`);if(tb)tb.classList.add('active');
  
  const backBtn = $('#btnHeaderBack');
  const title = $('.header-title');
  if(id === 'screenDashboard' || id === 'screenToolbar' || id === 'screenData') {
    if(backBtn) backBtn.style.display = 'none';
    if(title) title.style.marginLeft = '0';
  } else {
    if(backBtn) backBtn.style.display = 'block';
    if(title) title.style.marginLeft = '4px';
  }

  window.scrollTo({top:0,behavior:'smooth'});updateBars();
  if(id==='screenDashboard')refreshDash();if(id==='screenData')refreshDataRecords();if(id==='screenMap'){setTimeout(()=>{if(map)map.invalidateSize();initMap();},100);}
  if(id==='screenQuadrat')refreshQuadratTable();if(id==='screenTransect')refreshTransectTable();
  if(id==='screenEnvironment')loadEnvData();if(id==='screenDisturbCBI'){loadDistData();loadCBIData();}
  if(id==='screenPhotos'){refreshPhotos();refreshNotes();refreshAudio();}
  if(id==='screenAnalytics')refreshAnalytics();if(id==='screenExport')refreshPreview();
}
$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.screen)));
$$('.stat-card[data-tool]').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.tool)));
if($('#btnHeaderBack')) $('#btnHeaderBack').addEventListener('click',()=>switchScreen('screenToolbar'));

function updateBars(){const s=Store.getActive();const n=s?s.name:'No survey';
['quadratSurveyName','envSurveyName','distSurveyName','cbiSurveyName','photoSurveyName','exportSurveyName','analyticsSurveyName','transectSurveyName'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=n;});}

// ===== DASHBOARD =====
function refreshDash(){updateBars();}

// ===== DATA RECORDS =====
function refreshDataRecords(){
  const surveys=Store.getSurveys();
  const list=$('#dataRecordsList');
  if(!list)return;
  const filterType=$('#dataFilterType')?$('#dataFilterType').value:'all';

  // Collect all recorded data entries across all surveys
  let allRecords=[];
  surveys.forEach(sv=>{
    const svName=sv.name||'Unnamed';
    const svDate=sv.date||'';
    // Quadrats
    if(sv.quadrats&&sv.quadrats.length){
      sv.quadrats.forEach((q,qi)=>{
        const speciesNames=q.species?q.species.map(s=>s.name).filter(Boolean).join(', '):'No species';
        allRecords.push({type:'quadrat',icon:'Q',label:`Quadrat #${q.number||qi+1}`,detail:`${q.species?q.species.length:0} species · ${q.size||'—'}m²`,survey:svName,date:svDate,sortDate:svDate||'0000-00-00',surveyId:sv.id});
      });
    }
    // Transects
    if(sv.transects&&sv.transects.length){
      sv.transects.forEach((t,ti)=>{
        allRecords.push({type:'transect',icon:'T',label:`Transect #${t.number||ti+1}`,detail:`${t.length||'—'}m × ${t.width||'—'}m · ${t.intercepts?t.intercepts.length:0} intercepts`,survey:svName,date:svDate,sortDate:svDate||'0000-00-00',surveyId:sv.id});
      });
    }
    // Environment
    if(sv.environment){
      allRecords.push({type:'environment',icon:'E',label:'Environment Data',detail:`Elev: ${sv.environment.elevation||'—'}m · Slope: ${sv.environment.slope||'—'}° · ${sv.environment.weather||'—'}`,survey:svName,date:svDate,sortDate:svDate||'0000-00-00',surveyId:sv.id});
    }
    // Disturbance
    if(sv.disturbance){
      const dTypes=[];
      if(sv.disturbance.grazing&&sv.disturbance.grazing.present)dTypes.push('Grazing');
      if(sv.disturbance.logging&&sv.disturbance.logging.present)dTypes.push('Logging');
      if(sv.disturbance.fire&&sv.disturbance.fire.present)dTypes.push('Fire');
      if(sv.disturbance.human&&sv.disturbance.human.present)dTypes.push('Human');
      allRecords.push({type:'disturbance',icon:'D',label:'Disturbance & CBI',detail:dTypes.length?dTypes.join(', '):'No disturbance recorded',survey:svName,date:svDate,sortDate:svDate||'0000-00-00',surveyId:sv.id});
    }
    // Notes
    if(sv.notes&&sv.notes.length){
      sv.notes.forEach(n=>{
        const noteDate=n.time?n.time.split('T')[0]:svDate;
        const noteTime=n.time?new Date(n.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
        allRecords.push({type:'notes',icon:'N',label:`Note: ${n.category||'General'}`,detail:n.text?n.text.substring(0,60)+'…':'',survey:svName,date:noteDate,sortDate:noteDate||'0000-00-00',time:noteTime,surveyId:sv.id});
      });
    }
    // Photos
    if(sv.photos&&sv.photos.length){
      allRecords.push({type:'photos',icon:'P',label:`${sv.photos.length} Photo${sv.photos.length>1?'s':''}`,detail:`Attached to survey`,survey:svName,date:svDate,sortDate:svDate||'0000-00-00',surveyId:sv.id});
    }
  });

  // Filter
  if(filterType!=='all')allRecords=allRecords.filter(r=>r.type===filterType);

  if(!allRecords.length){
    list.innerHTML='<div class="data-records-empty"><svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1" fill="none"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg><p>No recorded data</p><p class="hint">Create a survey and record data from Tools</p></div>';
    return;
  }

  // Sort by date descending
  allRecords.sort((a,b)=>(b.sortDate||'').localeCompare(a.sortDate||''));

  // Group by date
  const groups={};
  allRecords.forEach(r=>{
    const dateKey=r.date||'Undated';
    if(!groups[dateKey])groups[dateKey]=[];
    groups[dateKey].push(r);
  });

  let html='';
  Object.entries(groups).forEach(([dateKey,records])=>{
    const displayDate=dateKey!=='Undated'?new Date(dateKey+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):dateKey;
    html+=`<div class="data-date-group"><div class="data-date-label">${displayDate}</div>`;
    records.forEach(r=>{
      html+=`<div class="data-record-card" data-sid="${r.surveyId}">
        <div class="data-record-icon type-${r.type}">${r.icon}</div>
        <div class="data-record-body">
          <div class="data-record-title">${esc(r.label)}</div>
          <div class="data-record-meta">${esc(r.survey)} · ${esc(r.detail)}</div>
        </div>
        <div class="data-record-time">${r.time||''}</div>
      </div>`;
    });
    html+='</div>';
  });
  list.innerHTML=html;

  // Clicking a record selects the survey and switches to Tools
  list.querySelectorAll('.data-record-card').forEach(c=>{
    c.addEventListener('click',()=>{
      Store.setActive(c.dataset.sid);
      updateBars();
      switchScreen('screenToolbar');
      toast('Survey selected');
    });
  });
}
// Data filter change
if($('#dataFilterType'))$('#dataFilterType').addEventListener('change',refreshDataRecords);
$('#btnNewSurvey').addEventListener('click',()=>{$('#surveyDate').value=new Date().toISOString().split('T')[0];$('#modalNewSurvey').classList.add('show');});
$('#btnCancelSurvey').addEventListener('click',()=>$('#modalNewSurvey').classList.remove('show'));
$('#btnSaveSurvey').addEventListener('click',()=>{
  const name=$('#surveyName').value.trim();if(!name){toast('Name required',true);return;}
  const sv={id:Date.now().toString(36)+Math.random().toString(36).substr(2,4),name,location:$('#surveyLocation').value.trim(),investigator:$('#surveyInvestigator').value.trim(),date:$('#surveyDate').value,quadrats:[],transects:[],environment:null,disturbance:null,cbi:null,photos:[],notes:[],audioNotes:[],waypoints:[]};
  if($('#surveyAutoGPS').checked&&curPos.lat){sv.gpsCoords=fmtCoords(curPos.lat,curPos.lng);sv.location=sv.location||sv.gpsCoords;}
  Store.add(sv);$('#modalNewSurvey').classList.remove('show');$('#surveyName').value='';$('#surveyLocation').value='';$('#surveyInvestigator').value='';refreshDash();updateBars();toast(`"${name}" created`);
});

// ===== MAP =====
let map=null,userMarker=null,wpMarkers=[],satLayer,terLayer,hybLayer;
function initMap(){if(typeof L==='undefined')return;if(map)return;const la=curPos.lat||20.5937,ln=curPos.lng||78.9629;
  try{map=L.map('mapView',{zoomControl:false}).setView([la,ln],14);}catch(err){return;}
  satLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
  terLayer=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
  hybLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
  satLayer.addTo(map);
  if(curPos.lat)userMarker=L.circleMarker([curPos.lat,curPos.lng],{radius:8,color:'#5ee5a0',fillColor:'#5ee5a0',fillOpacity:.8,weight:2}).addTo(map).bindPopup('You');
  refreshMapWps();}
$('#btnLocateMe').addEventListener('click',()=>{if(map&&curPos.lat){map.setView([curPos.lat,curPos.lng],16);toast('Centered');}else toast('No GPS',true);});
function mapHas(Ly){return map&&Ly&&map.hasLayer(Ly);}
$('#btnMapSatellite').addEventListener('click',()=>{if(!map||!satLayer)return;if(mapHas(terLayer))map.removeLayer(terLayer);if(mapHas(hybLayer))map.removeLayer(hybLayer);if(!mapHas(satLayer))satLayer.addTo(map);toast('Satellite');});
$('#btnMapTerrain').addEventListener('click',()=>{if(!map||!terLayer)return;if(mapHas(satLayer))map.removeLayer(satLayer);if(mapHas(hybLayer))map.removeLayer(hybLayer);if(!mapHas(terLayer))terLayer.addTo(map);toast('Terrain');});
$('#btnMapHybrid').addEventListener('click',()=>{if(!map||!hybLayer)return;if(mapHas(satLayer))map.removeLayer(satLayer);if(mapHas(terLayer))map.removeLayer(terLayer);if(!mapHas(hybLayer))hybLayer.addTo(map);toast('Hybrid');});

// ===== WAYPOINTS =====
function getWps(){try{const w=JSON.parse(localStorage.getItem('forest_wps')||'[]');return Array.isArray(w)?w:[];}catch(err){return [];}}
function saveWps(w){localStorage.setItem('forest_wps',JSON.stringify(w));}
function refreshMapWps(){if(!map||typeof L==='undefined')return;wpMarkers.forEach(m=>{try{map.removeLayer(m);}catch(_){}});wpMarkers=[];getWps().forEach(wp=>{if(!wp||!Number.isFinite(wp.lat)||!Number.isFinite(wp.lng))return;const m=L.marker([wp.lat,wp.lng]).addTo(map).bindPopup(`<b>${esc(wp.name||'WP')}</b><br>${esc(wp.type||'')}`);wpMarkers.push(m);});}
function refreshWpList(){const wps=getWps();const list=$('#waypointList');if(!list)return;if(!wps.length){list.innerHTML='';return;}
  const icons={plot:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',sample:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14.5 2v10.5L22 22H2L9.5 12.5V2"/><path d="M9.5 4h5"/></svg>',landmark:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M8 21h8M12 17v4M12 3l-8 14h16z"/></svg>',trail:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',water:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22a8 8 0 0 0 8-8c0-4.4-8-12-8-12s-8 7.6-8 12a8 8 0 0 0 8 8z"/></svg>',camp:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2L2 22h20L12 2z"/></svg>',other:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/></svg>'};
  list.innerHTML=wps.map((w,i)=>{const la=w&&Number.isFinite(w.lat)?w.lat:NaN,ln=w&&Number.isFinite(w.lng)?w.lng:NaN,cord=(Number.isFinite(la)&&Number.isFinite(ln))?`${la.toFixed(5)}, ${ln.toFixed(5)}`:'—';return`<div class="waypoint-item"><span class="wp-icon">${icons[(w&&w.type)||'other']||icons.other}</span><div class="wp-info"><div class="wp-name">${esc(w&&w.name||'Waypoint')}</div><div class="wp-coords">${cord}</div></div><button class="wp-delete" data-i="${i}">✕</button></div>`;}).join('');
  list.querySelectorAll('.wp-delete').forEach(b=>{b.addEventListener('click',()=>{const w=getWps();w.splice(+b.dataset.i,1);saveWps(w);refreshWpList();if(map)refreshMapWps();toast('Deleted');});});}
$('#btnAddWaypoint').addEventListener('click',()=>{if(!curPos.lat){toast('No GPS',true);return;}const n=prompt('Waypoint name:');if(!n)return;const w=getWps();w.push({name:n,type:'plot',lat:curPos.lat,lng:curPos.lng,time:new Date().toISOString()});saveWps(w);if(map)refreshMapWps();refreshWpList();toast('Waypoint added');});
$('#btnAddWaypointManual').addEventListener('click',()=>{const n=$('#waypointName').value.trim();if(!n){toast('Enter name',true);return;}if(!curPos.lat){toast('No GPS',true);return;}const w=getWps();w.push({name:n,type:$('#waypointType').value,lat:curPos.lat,lng:curPos.lng,notes:$('#waypointNotes').value.trim(),time:new Date().toISOString()});saveWps(w);$('#waypointName').value='';$('#waypointNotes').value='';if(map)refreshMapWps();refreshWpList();toast('Saved');});

// ===== QUADRAT =====
let spCount=0;
function addSpeciesEntry(){spCount++;const d=document.createElement('div');d.className='species-entry';
d.innerHTML=`<div class="species-entry-header"><span class="species-entry-num">Species #${spCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species Name</label><input type="text" class="sp-name" placeholder="e.g., Shorea robusta" list="speciesDatalist" /></div>
<div class="form-row"><div class="form-group"><label>Life Stage</label><select class="sp-stage"><option value="tree">Tree</option><option value="sapling">Sapling</option><option value="seedling">Seedling</option></select></div><div class="form-group"><label>Abundance</label><input type="number" class="sp-abundance" min="0" placeholder="Count" /></div></div>
<div class="form-row"><div class="form-group"><label>DBH (cm)</label><input type="number" class="sp-dbh" min="0" step="0.1" /></div><div class="form-group"><label>Height (m)</label><input type="number" class="sp-height" min="0" step="0.1" /></div></div>
<div class="form-row"><div class="form-group"><label>Phenology</label><select class="sp-phenology"><option value="">—</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="leaf-flush">Leaf Flush</option><option value="leaf-fall">Leaf Fall</option><option value="dormant">Dormant</option><option value="vegetative">Vegetative</option></select></div><div class="form-group"><label>Health</label><input type="text" class="sp-health" placeholder="e.g., Healthy" /></div></div>`;
d.querySelector('.species-remove').addEventListener('click',()=>d.remove());$('#speciesList').appendChild(d);
// Autocomplete
const inp=d.querySelector('.sp-name');if(!document.getElementById('speciesDatalist')){const dl=document.createElement('datalist');dl.id='speciesDatalist';SPECIES_DB.forEach(s=>{const o=document.createElement('option');o.value=s;dl.appendChild(o);});document.body.appendChild(dl);}}
$('#btnAddSpecies').addEventListener('click',addSpeciesEntry);
$('#btnQuadratGPS').addEventListener('click',()=>{if(curPos.lat){$('#quadratGPS').value=fmtCoords(curPos.lat,curPos.lng);toast('GPS filled');}else toast('No GPS',true);});
$('#btnSaveQuadrat').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('Select survey',true);return;}const entries=$$('#speciesList .species-entry');if(!entries.length){toast('Add species',true);return;}
  const q={number:parseInt($('#quadratNumber').value)||1,size:parseFloat($('#quadratSize').value)||0,shape:$('#quadratShape').value,gps:$('#quadratGPS').value,species:Array.from(entries).map(e=>({name:e.querySelector('.sp-name').value.trim(),stage:e.querySelector('.sp-stage').value,abundance:parseInt(e.querySelector('.sp-abundance').value)||0,dbh:parseFloat(e.querySelector('.sp-dbh').value)||0,height:parseFloat(e.querySelector('.sp-height').value)||0,phenology:e.querySelector('.sp-phenology').value,health:e.querySelector('.sp-health').value.trim()}))};
  if(!s.quadrats)s.quadrats=[];s.quadrats.push(q);Store.update(s);$('#quadratNumber').value=q.number+1;$('#speciesList').innerHTML='';spCount=0;addSpeciesEntry();
  toast(`Quadrat #${q.number} saved`);refreshQuadratTable();switchScreen('screenToolbar');});

// ===== TRANSECT =====
let intCount=0;
function addIntercept(){intCount++;const d=document.createElement('div');d.className='species-entry';
d.innerHTML=`<div class="species-entry-header"><span class="species-entry-num">Intercept #${intCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species</label><input type="text" class="int-name" placeholder="Species name" list="speciesDatalist" /></div>
<div class="form-row"><div class="form-group"><label>Distance (m)</label><input type="number" class="int-dist" min="0" step="0.1" /></div><div class="form-group"><label>Cover %</label><input type="number" class="int-cover" min="0" max="100" /></div></div>`;
d.querySelector('.species-remove').addEventListener('click',()=>d.remove());$('#interceptList').appendChild(d);}
$('#btnAddIntercept').addEventListener('click',addIntercept);
$('#btnTransectStartGPS').addEventListener('click',()=>{if(curPos.lat)$('#transectStartGPS').value=fmtCoords(curPos.lat,curPos.lng);});
$('#btnTransectEndGPS').addEventListener('click',()=>{if(curPos.lat)$('#transectEndGPS').value=fmtCoords(curPos.lat,curPos.lng);});
$('#btnSaveTransect').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('Select survey',true);return;}
  const t={number:parseInt($('#transectNumber').value)||1,length:parseFloat($('#transectLength').value)||0,width:parseFloat($('#transectWidth').value)||0,bearing:parseFloat($('#transectBearing').value)||0,startGPS:$('#transectStartGPS').value,endGPS:$('#transectEndGPS').value,
    intercepts:Array.from($$('#interceptList .species-entry')).map(e=>({name:e.querySelector('.int-name').value.trim(),distance:parseFloat(e.querySelector('.int-dist').value)||0,cover:parseFloat(e.querySelector('.int-cover').value)||0}))};
  if(!s.transects)s.transects=[];s.transects.push(t);Store.update(s);$('#transectNumber').value=t.number+1;$('#interceptList').innerHTML='';intCount=0;addIntercept();toast(`Transect #${t.number} saved`);refreshTransectTable();switchScreen('screenToolbar');});

function refreshTransectTable(){const s=Store.getActive();const tb=$('#transectTableBody');if(!tb)return;if(!s||!s.transects||!s.transects.length){tb.innerHTML='<tr><td colspan="7" class="table-empty">No data</td></tr>';return;}
  let r='';s.transects.forEach((t,ti)=>{const ints=t.intercepts&&t.intercepts.length?t.intercepts:[{name:'—',distance:'—',cover:'—'}];ints.forEach((n,ni)=>{r+=`<tr>${ni===0?`<td>${t.number}</td><td>${t.length}</td><td>${t.width}</td>`:'<td></td><td></td><td></td>'}<td class="species-name-cell">${esc(n.name||'—')}</td><td>${n.distance||'—'}</td><td>${n.cover||'—'}</td>${ni===0?`<td class="action-btns"><button data-action="del-t" data-i="${ti}">🗑️</button></td>`:'<td></td>'}</tr>`;});});
  tb.innerHTML=r;tb.querySelectorAll('[data-action="del-t"]').forEach(b=>{b.addEventListener('click',()=>{if(confirm('Delete?')){s.transects.splice(+b.dataset.i,1);Store.update(s);refreshTransectTable();toast('Deleted');}});});}

// ===== ENVIRONMENT =====
$('#btnAutoFillEnv').addEventListener('click',()=>{if(curPos.alt!==null)$('#envElevation').value=Math.round(curPos.alt);const t=$('#teleTemp').textContent;const h=$('#teleHumidity').textContent;if(t!=='--°C')$('#envTemperature').value=parseFloat(t);if(h!=='---%')$('#envHumidity').value=parseInt(h);toast('Auto-filled');});
$('#btnSaveEnv').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('Select survey',true);return;}s.environment={slope:parseFloat($('#envSlope').value)||null,aspect:$('#envAspect').value,elevation:parseFloat($('#envElevation').value)||null,canopyCover:parseFloat($('#envCanopyCover').value)||null,soilType:$('#envSoilType').value,soilMoisture:$('#envSoilMoisture').value,soilColor:$('#envSoilColor').value.trim(),temperature:parseFloat($('#envTemperature').value)||null,humidity:parseFloat($('#envHumidity').value)||null,weather:$('#envWeather').value};Store.update(s);toast('Saved');switchScreen('screenToolbar');});
function loadEnvData(){const s=Store.getActive();if(!s||!s.environment)return;const e=s.environment;if(e.slope)$('#envSlope').value=e.slope;if(e.aspect)$('#envAspect').value=e.aspect;if(e.elevation)$('#envElevation').value=e.elevation;if(e.canopyCover)$('#envCanopyCover').value=e.canopyCover;if(e.soilType)$('#envSoilType').value=e.soilType;if(e.soilMoisture)$('#envSoilMoisture').value=e.soilMoisture;if(e.soilColor)$('#envSoilColor').value=e.soilColor;if(e.temperature)$('#envTemperature').value=e.temperature;if(e.humidity)$('#envHumidity').value=e.humidity;if(e.weather)$('#envWeather').value=e.weather;}

// ===== CANOPY COVER ESTIMATION =====
$('#canopyPhotoInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const c=$('#canopyCanvas');c.width=200;c.height=200;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,200,200);const data=ctx.getImageData(0,0,200,200).data;let green=0,total=200*200;for(let i=0;i<data.length;i+=4){const r2=data[i],g=data[i+1],b=data[i+2];if(g>r2&&g>b&&g>60)green++;}const pct=Math.round((green/total)*100);$('#canopyEstimate').textContent=`≈ ${pct}% canopy cover`;$('#envCanopyCover').value=pct;toast(`Canopy: ~${pct}%`);};img.src=ev.target.result;};reader.readAsDataURL(f);e.target.value='';});

// ===== DISTURBANCE =====
const dToggles=[{cb:'distGrazingPresent',grp:'grazingSeverityGroup',sl:'distGrazingSeverity',dsp:'distGrazingSeverityVal'},{cb:'distLoggingPresent',grp:'loggingSeverityGroup',sl:'distLoggingSeverity',dsp:'distLoggingSeverityVal'},{cb:'distFirePresent',grp:'fireSeverityGroup',sl:'distFireSeverity',dsp:'distFireSeverityVal'},{cb:'distHumanPresent',grp:'humanSeverityGroup',sl:'distHumanSeverity',dsp:'distHumanSeverityVal'}];
dToggles.forEach(t=>{const c=document.getElementById(t.cb),g=document.getElementById(t.grp),s=document.getElementById(t.sl),d=document.getElementById(t.dsp);if(!c||!g||!s||!d)return;c.addEventListener('change',()=>g.classList.toggle('visible',c.checked));s.addEventListener('input',()=>{d.textContent=s.value;});});
function loadDistData(){const s=Store.getActive();if(!s||!s.disturbance)return;const d=s.disturbance;if(d.grazing){$('#distGrazingPresent').checked=d.grazing.present;if(d.grazing.present)$('#grazingSeverityGroup').classList.add('visible');$('#distGrazingSeverity').value=d.grazing.severity;$('#distGrazingSeverityVal').textContent=d.grazing.severity;$('#distGrazingType').value=d.grazing.type||'';}if(d.logging){$('#distLoggingPresent').checked=d.logging.present;if(d.logging.present)$('#loggingSeverityGroup').classList.add('visible');$('#distLoggingSeverity').value=d.logging.severity;$('#distLoggingSeverityVal').textContent=d.logging.severity;$('#distLoggingType').value=d.logging.type||'';}if(d.fire){$('#distFirePresent').checked=d.fire.present;if(d.fire.present)$('#fireSeverityGroup').classList.add('visible');$('#distFireSeverity').value=d.fire.severity;$('#distFireSeverityVal').textContent=d.fire.severity;$('#distFireType').value=d.fire.type||'';$('#distFireRecency').value=d.fire.recency||'';}if(d.human){$('#distHumanPresent').checked=d.human.present;if(d.human.present)$('#humanSeverityGroup').classList.add('visible');$('#distHumanSeverity').value=d.human.severity;$('#distHumanSeverityVal').textContent=d.human.severity;}if(d.notes)$('#distNotes').value=d.notes;}

// ===== CBI =====
const cbiL={substrate:['cbiSubLitter','cbiSubDuff','cbiSubSoil'],herbaceous:['cbiHerbFreq','cbiHerbMort'],shrub:['cbiShrubMort','cbiShrubChar'],intermediate:['cbiIntChar','cbiIntMort'],overstory:['cbiOverScorch','cbiOverMort','cbiOverChar']};
function recalcCBI(){let tot=0,cnt=0;Object.entries(cbiL).forEach(([l,ids])=>{let lt=0;ids.forEach(id=>{const inp=document.getElementById(id);if(inp)lt+=parseFloat(inp.value)||0;});const avg=ids.length?lt/ids.length:0;const el=document.getElementById('cbi'+l.charAt(0).toUpperCase()+l.slice(1)+'Avg');if(el)el.textContent=avg.toFixed(2);tot+=avg;cnt++;});const c=cnt?tot/cnt:0;const cs=$('#cbiCompositeScore'),cf=$('#cbiScoreFill');if(cs)cs.textContent=c.toFixed(2);if(cf)cf.style.width=((c/3)*100)+'%';}
$$('.cbi-select').forEach(s=>s.addEventListener('change',recalcCBI));
$('#btnSaveDisturbCBI').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('Select survey',true);return;}
s.disturbance={grazing:{present:$('#distGrazingPresent').checked,severity:+$('#distGrazingSeverity').value,type:$('#distGrazingType').value},logging:{present:$('#distLoggingPresent').checked,severity:+$('#distLoggingSeverity').value,type:$('#distLoggingType').value},fire:{present:$('#distFirePresent').checked,severity:+$('#distFireSeverity').value,type:$('#distFireType').value,recency:$('#distFireRecency').value},human:{present:$('#distHumanPresent').checked,severity:+$('#distHumanSeverity').value,types:Array.from($('#distHumanType').selectedOptions).map(o=>o.value)},notes:$('#distNotes').value.trim()};
s.cbi={};Object.entries(cbiL).forEach(([l,ids])=>{s.cbi[l]={};ids.forEach(id=>s.cbi[l][id]=parseFloat(document.getElementById(id).value)||0);});Store.update(s);toast('Disturbance & CBI saved');switchScreen('screenToolbar');});
function loadCBIData(){const s=Store.getActive();if(!s||!s.cbi)return;Object.entries(cbiL).forEach(([l,ids])=>{if(s.cbi[l])ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=s.cbi[l][id];});});recalcCBI();}

// ===== PHOTOS =====
const MX=800;function compress(file,cb){const r=new FileReader();r.onload=e=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');let w=img.width,h=img.height;if(w>MX){h=(MX/w)*h;w=MX;}if(h>MX){w=(MX/h)*w;h=MX;}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',0.6));};img.src=e.target.result;};r.readAsDataURL(file);}
$('#photoInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const s=Store.getActive();if(!s){toast('Select survey',true);return;}compress(f,d=>{if(!s.photos)s.photos=[];s.photos.push({data:d,quadrat:parseInt($('#photoQuadratRef').value)||null,time:new Date().toISOString()});Store.update(s);refreshPhotos();toast('Photo saved');});e.target.value='';});
function refreshPhotos(){const s=Store.getActive();const g=$('#photoGallery');if(!s||!s.photos||!s.photos.length){g.innerHTML='';return;}g.innerHTML=s.photos.map((p,i)=>`<div class="photo-thumb"><img src="${p.data}" alt="Photo" /><button class="photo-thumb-delete" data-i="${i}">✕</button></div>`).join('');
g.querySelectorAll('.photo-thumb-delete').forEach(b=>{b.addEventListener('click',()=>{s.photos.splice(+b.dataset.i,1);Store.update(s);refreshPhotos();toast('Deleted');});});}

// ===== VOICE NOTES =====
let mediaRec=null,audioChunks=[];
$('#btnStartRecording').addEventListener('click',async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});mediaRec=new MediaRecorder(stream);audioChunks=[];mediaRec.ondataavailable=e=>audioChunks.push(e.data);mediaRec.onstop=()=>{const blob=new Blob(audioChunks,{type:'audio/webm'});const reader=new FileReader();reader.onload=ev=>{const s=Store.getActive();if(!s)return;if(!s.audioNotes)s.audioNotes=[];s.audioNotes.push({data:ev.target.result,time:new Date().toISOString()});Store.update(s);refreshAudio();toast('Voice note saved');};reader.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());};
mediaRec.start();$('#recordingStatus').textContent='🔴 Recording...';$('#btnStartRecording').disabled=true;$('#btnStopRecording').disabled=false;}catch(e){toast('Mic unavailable',true);}});
$('#btnStopRecording').addEventListener('click',()=>{if(mediaRec&&mediaRec.state==='recording'){mediaRec.stop();$('#recordingStatus').textContent='Saved';$('#btnStartRecording').disabled=false;$('#btnStopRecording').disabled=true;}});
function refreshAudio(){const s=Store.getActive();const list=$('#audioList');if(!list)return;if(!s||!s.audioNotes||!s.audioNotes.length){list.innerHTML='<div class="empty-state small"><p>No voice notes</p></div>';return;}
list.innerHTML=s.audioNotes.map((a,i)=>`<div class="audio-item"><audio controls src="${a.data}"></audio><button data-i="${i}">✕</button></div>`).join('');
list.querySelectorAll('button').forEach(b=>{b.addEventListener('click',()=>{s.audioNotes.splice(+b.dataset.i,1);Store.update(s);refreshAudio();toast('Deleted');});});}

// ===== NOTES =====
function refreshNotes(){const s=Store.getActive();const l=$('#notesList');if(!s||!s.notes||!s.notes.length){l.innerHTML='<div class="empty-state small"><p>No notes</p></div>';return;}
l.innerHTML=s.notes.map((n,i)=>`<div class="note-item"><div class="note-item-header"><span class="note-badge">${esc(n.category)}</span><span>${n.quadrat?'Q#'+n.quadrat:''}</span></div><p>${esc(n.text)}</p><button class="note-item-delete" data-i="${i}">Delete</button></div>`).join('');
l.querySelectorAll('.note-item-delete').forEach(b=>{b.addEventListener('click',()=>{s.notes.splice(+b.dataset.i,1);Store.update(s);refreshNotes();toast('Deleted');});});}
$('#btnAddNote').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('Select survey',true);return;}const t=$('#noteContent').value.trim();if(!t){toast('Enter text',true);return;}if(!s.notes)s.notes=[];s.notes.push({quadrat:parseInt($('#noteQuadratRef').value)||null,category:$('#noteCategory').value,text:t,time:new Date().toISOString()});Store.update(s);$('#noteContent').value='';refreshNotes();toast('Note saved');switchScreen('screenToolbar');});

// ===== QUADRAT TABLE =====
function refreshQuadratTable(){const s=Store.getActive();const tb=$('#quadratTableBody');if(!tb)return;if(!s||!s.quadrats||!s.quadrats.length){tb.innerHTML='<tr><td colspan="9" class="table-empty">No data</td></tr>';return;}
let r='';s.quadrats.forEach((q,qi)=>{const sp=q.species&&q.species.length?q.species:[{name:'—',stage:'—',phenology:'—',abundance:'—',dbh:'—',height:'—'}];sp.forEach((x,si)=>{const first=si===0;const badge=x.stage&&x.stage!=='—'?`<span class="stage-badge ${esc(x.stage)}">${esc(x.stage)}</span>`:'—';
r+=`<tr>${first?`<td>${q.number}</td><td>${q.size}</td>`:'<td></td><td></td>'}<td class="species-name-cell">${esc(x.name||'—')}</td><td>${badge}</td><td>${x.phenology||'—'}</td><td>${x.abundance||'—'}</td><td>${x.dbh||'—'}</td><td>${x.height||'—'}</td>${first?`<td class="action-btns"><button data-action="dq" data-i="${qi}">🗑️</button></td>`:'<td></td>'}</tr>`;});});
tb.innerHTML=r;tb.querySelectorAll('[data-action="dq"]').forEach(b=>{b.addEventListener('click',()=>{if(confirm('Delete?')){s.quadrats.splice(+b.dataset.i,1);Store.update(s);refreshQuadratTable();toast('Deleted');}});});}

// ===== ANALYTICS =====
function refreshAnalytics(){const s=Store.getActive();if(!s||!s.quadrats||!s.quadrats.length){$('#analyticRichness').textContent='0';$('#analyticShannon').textContent='0.000';$('#analyticSimpson').textContent='0.000';$('#analyticSimpsonDiv').textContent='0.000';$('#analyticEvenness').textContent='0.000';$('#analyticTotalN').textContent='0';$('#analyticBasalTotal').textContent='0.000 m²';$('#analyticBasalHa').textContent='0.000 m²/ha';$('#iviTableBody').innerHTML='<tr><td colspan="8" class="table-empty">No data</td></tr>';$('#dbhChart').innerHTML='<div class="chart-empty">No DBH data</div>';$('#speciesAccumChart').innerHTML='<div class="chart-empty">No data</div>';return;}

  // Aggregate all species data
  const speciesMap={},totalArea=s.quadrats.reduce((a,q)=>a+(q.size||0),0)/10000;
  let totalN=0;
  s.quadrats.forEach((q,qi)=>{if(q.species)q.species.forEach(sp=>{if(!sp.name)return;const k=sp.name;if(!speciesMap[k])speciesMap[k]={abundance:0,dbhSum:0,dbhCount:0,basalArea:0,quadrats:new Set()};speciesMap[k].abundance+=sp.abundance||0;totalN+=sp.abundance||0;if(sp.dbh>0){speciesMap[k].dbhSum+=sp.dbh;speciesMap[k].dbhCount++;speciesMap[k].basalArea+=Math.PI*Math.pow(sp.dbh/200,2)*(sp.abundance||1);}speciesMap[k].quadrats.add(qi);});});

  const speciesList=Object.keys(speciesMap).filter(k=>speciesMap[k].abundance>0);const S=speciesList.length;
  let H=0;
  if(totalN>0){speciesList.forEach(k=>{const pi=speciesMap[k].abundance/totalN;if(pi>0)H-=pi*Math.log(pi);});}
  let D=0;
  if(totalN>1){speciesList.forEach(k=>{const n=speciesMap[k].abundance;D+=n*(n-1);});D=D/(totalN*(totalN-1));}
  else if(totalN===1)D=1;
  const E=S>1&&totalN>0?H/Math.log(S):0;
  // Basal area
  let totalBA=0;speciesList.forEach(k=>totalBA+=speciesMap[k].basalArea);

  $('#analyticRichness').textContent=S;$('#analyticShannon').textContent=totalN>0?H.toFixed(3):'0.000';$('#analyticSimpson').textContent=totalN>1?D.toFixed(3):(totalN===1?'1.000':'0.000');$('#analyticSimpsonDiv').textContent=totalN>1?(1-D).toFixed(3):(totalN===1?'0.000':'0.000');$('#analyticEvenness').textContent=E.toFixed(3);$('#analyticTotalN').textContent=totalN;
  $('#analyticBasalTotal').textContent=totalBA.toFixed(4)+' m²';$('#analyticBasalHa').textContent=(totalArea>0?(totalBA/totalArea).toFixed(3):'—')+' m²/ha';

  // IVI Table
  const nQuad=s.quadrats.length;let iviData=[];
  speciesList.forEach(k=>{const d2=speciesMap[k];const density=totalArea>0?d2.abundance/totalArea:d2.abundance;const freq=d2.quadrats.size/nQuad;const dom=totalArea>0?d2.basalArea/totalArea:d2.basalArea;iviData.push({name:k,density,freq,dom,abundance:d2.abundance,basalArea:d2.basalArea});});
  const totalDensity=iviData.reduce((a,x)=>a+x.density,0);const totalFreq=iviData.reduce((a,x)=>a+x.freq,0);const totalDom=iviData.reduce((a,x)=>a+x.dom,0);
  iviData.forEach(x=>{x.relDensity=totalDensity?x.density/totalDensity*100:0;x.relFreq=totalFreq?x.freq/totalFreq*100:0;x.relDom=totalDom?x.dom/totalDom*100:0;x.ivi=x.relDensity+x.relFreq+x.relDom;});
  iviData.sort((a,b)=>b.ivi-a.ivi);
  const iviTb=$('#iviTableBody');iviTb.innerHTML=iviData.map(x=>`<tr><td class="species-name-cell">${esc(x.name)}</td><td>${x.density.toFixed(1)}</td><td>${x.relDensity.toFixed(1)}%</td><td>${(x.freq*100).toFixed(1)}%</td><td>${x.relFreq.toFixed(1)}%</td><td>${x.basalArea.toFixed(4)}</td><td>${x.relDom.toFixed(1)}%</td><td style="font-weight:700;color:var(--emerald)">${x.ivi.toFixed(1)}</td></tr>`).join('');

  // DBH Class Distribution
  const dbhClasses={'0-10':0,'10-20':0,'20-30':0,'30-40':0,'40-50':0,'50-60':0,'60+':0};
  s.quadrats.forEach(q=>{if(q.species)q.species.forEach(sp=>{if(sp.dbh>0){const cnt=sp.abundance||1;if(sp.dbh<10)dbhClasses['0-10']+=cnt;else if(sp.dbh<20)dbhClasses['10-20']+=cnt;else if(sp.dbh<30)dbhClasses['20-30']+=cnt;else if(sp.dbh<40)dbhClasses['30-40']+=cnt;else if(sp.dbh<50)dbhClasses['40-50']+=cnt;else if(sp.dbh<60)dbhClasses['50-60']+=cnt;else dbhClasses['60+']+=cnt;}});});
  const maxDBH=Math.max(...Object.values(dbhClasses),1);
  const dbhChart=$('#dbhChart');dbhChart.innerHTML=Object.entries(dbhClasses).map(([k,v])=>`<div class="bar-col"><div class="bar-val">${v}</div><div class="bar-fill" style="height:${(v/maxDBH)*140}px;"></div><div class="bar-label">${k}</div></div>`).join('');

  // Species Accumulation Curve
  const accum=$('#speciesAccumChart');const seen=new Set();const points=[];
  s.quadrats.forEach((q,i)=>{if(q.species)q.species.forEach(sp=>{if(sp.name)seen.add(sp.name);});points.push({x:i+1,y:seen.size});});
  const maxY=Math.max(...points.map(p=>p.y),1);
  accum.innerHTML=points.map(p=>`<div class="bar-col"><div class="bar-val">${p.y}</div><div class="bar-fill" style="height:${(p.y/maxY)*140}px;background:linear-gradient(180deg,var(--cyan),var(--emerald));"></div><div class="bar-label">Q${p.x}</div></div>`).join('');
}

// ===== EXPORT =====
function refreshPreview(){const s=Store.getActive();const p=$('#dataPreview');if(!s){p.innerHTML='<div class="empty-state small"><p>Select survey</p></div>';return;}p.textContent=JSON.stringify(s,null,2);}
function dl(c,fn,m){const b=new Blob([c],{type:m});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();URL.revokeObjectURL(a.href);}
function toCSV(s){const rows=[['Survey','Date','Location','Investigator','Q#','Size','Species','Stage','Phenology','Abundance','DBH','Height','Health','GPS']];if(s.quadrats)s.quadrats.forEach(q=>{if(q.species)q.species.forEach(sp=>{rows.push([s.name,s.date,s.location,s.investigator||'',q.number,q.size,sp.name,sp.stage,sp.phenology||'',sp.abundance,sp.dbh,sp.height,sp.health||'',q.gps||'']);});});return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');}
$('#btnExportCSV').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('No survey',true);return;}dl(toCSV(s),s.name.replace(/\W/g,'_')+'_survey.csv','text/csv');toast('CSV exported');});
$('#btnExportJSON').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('No survey',true);return;}dl(JSON.stringify(s,null,2),s.name.replace(/\W/g,'_')+'_survey.json','application/json');toast('JSON exported');});
$('#btnExportAllCSV').addEventListener('click',()=>{const sv=Store.getSurveys();if(!sv.length){toast('No surveys',true);return;}dl(sv.map(s=>toCSV(s)).join('\n'),'all_surveys.csv','text/csv');toast('All exported');});
$('#btnExportGPX').addEventListener('click',()=>{const w=getWps();if(!w.length){toast('No waypoints',true);return;}let g='<?xml version="1.0"?>\n<gpx version="1.1" creator="ForestCapture">\n';w.forEach(p=>{g+=`<wpt lat="${p.lat}" lon="${p.lng}"><name>${esc(p.name)}</name><desc>${esc(p.type)}</desc><time>${p.time}</time></wpt>\n`;});g+='</gpx>';dl(g,'waypoints.gpx','application/gpx+xml');toast('GPX exported');});

// Summary Report
$('#btnExportReport').addEventListener('click',()=>{const s=Store.getActive();if(!s){toast('No survey',true);return;}
  // Calculate analytics for report
  const speciesMap={};let totalN=0;s.quadrats&&s.quadrats.forEach(q=>{q.species&&q.species.forEach(sp=>{if(!sp.name)return;if(!speciesMap[sp.name])speciesMap[sp.name]={abundance:0,ba:0};speciesMap[sp.name].abundance+=sp.abundance||0;totalN+=sp.abundance||0;if(sp.dbh>0)speciesMap[sp.name].ba+=Math.PI*Math.pow(sp.dbh/200,2)*(sp.abundance||1);});});
  const reportRich=Object.keys(speciesMap).filter(k=>(speciesMap[k].abundance||0)>0).length;
  let H=0;if(totalN>0){Object.values(speciesMap).forEach(v=>{const p=v.abundance/totalN;if(p>0)H-=p*Math.log(p);});}
  let html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Survey Report — ${esc(s.name)}</title><style>body{font-family:'Inter','Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1a1a1a;}h1{color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px;}h2{color:#15803d;margin-top:24px;}table{width:100%;border-collapse:collapse;margin:12px 0;}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:14px;}th{background:#f0f9f0;}.species{font-style:italic;}.stat{font-weight:bold;color:#16a34a;}</style></head><body>`;
  html+=`<h1>🌲 Forest Capture — Survey Report</h1><table><tr><th>Survey</th><td>${esc(s.name)}</td></tr><tr><th>Date</th><td>${s.date||''}</td></tr><tr><th>Location</th><td>${esc(s.location||'')}</td></tr><tr><th>Investigator</th><td>${esc(s.investigator||'')}</td></tr><tr><th>GPS</th><td>${s.gpsCoords||''}</td></tr></table>`;
  html+=`<h2>Summary Statistics</h2><table><tr><th>Total Quadrats</th><td>${s.quadrats?s.quadrats.length:0}</td></tr><tr><th>Species richness (S)</th><td class="stat">${reportRich}</td></tr><tr><th>Total individuals (N)</th><td>${totalN}</td></tr><tr><th>Shannon–Wiener H′ (natural log)</th><td class="stat">${totalN>0?H.toFixed(3):'—'}</td></tr></table>`;
  if(s.quadrats&&s.quadrats.length){html+=`<h2>Quadrat Data</h2><table><tr><th>Q#</th><th>Size</th><th>Species</th><th>Stage</th><th>Phenology</th><th>Abundance</th><th>DBH</th><th>Height</th></tr>`;s.quadrats.forEach(q=>{q.species&&q.species.forEach(sp=>{html+=`<tr><td>${q.number}</td><td>${q.size}</td><td class="species">${esc(sp.name)}</td><td>${sp.stage}</td><td>${sp.phenology||''}</td><td>${sp.abundance}</td><td>${sp.dbh}</td><td>${sp.height}</td></tr>`;});});html+=`</table>`;}
  if(s.environment){html+=`<h2>Environmental Variables</h2><table>`;const e=s.environment;Object.entries(e).forEach(([k,v])=>{if(v)html+=`<tr><th>${k}</th><td>${v}</td></tr>`;});html+=`</table>`;}
  html+=`<p style="margin-top:32px;color:#888;font-size:12px;">Generated by Forest Capture — ${new Date().toLocaleString()}</p></body></html>`;
  dl(html,s.name.replace(/\W/g,'_')+'_report.html','text/html');toast('Report generated');});

// Backup/Restore
function doBackup(){const all={surveys:Store._d(),waypoints:getWps(),theme:localStorage.getItem('forest_survey_theme')};dl(JSON.stringify(all,null,2),'forest_survey_backup_'+new Date().toISOString().split('T')[0]+'.json','application/json');toast('Backup saved');}
function doRestore(file){if(!file)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.surveys)localStorage.setItem(SK,JSON.stringify(d.surveys));if(d.waypoints)saveWps(d.waypoints);if(d.theme)localStorage.setItem('forest_survey_theme',d.theme);refreshDash();updateBars();toast('Data restored');location.reload();}catch(e){toast('Invalid backup file',true);}};r.readAsText(file);}
function doClearAll(){if(!confirm('Delete ALL data?'))return;if(!confirm('This cannot be undone!'))return;localStorage.removeItem(SK);localStorage.removeItem('forest_wps');refreshDash();updateBars();toast('All cleared');}
// Export screen buttons
if($('#btnBackupAll'))$('#btnBackupAll').addEventListener('click',doBackup);
if($('#restoreInput'))$('#restoreInput').addEventListener('change',e=>{doRestore(e.target.files[0]);e.target.value='';});
if($('#btnClearAll'))$('#btnClearAll').addEventListener('click',doClearAll);
// Settings panel duplicate buttons
if($('#btnBackupAllSettings'))$('#btnBackupAllSettings').addEventListener('click',doBackup);
if($('#restoreInputSettings'))$('#restoreInputSettings').addEventListener('change',e=>{doRestore(e.target.files[0]);e.target.value='';});
if($('#btnClearAllSettings'))$('#btnClearAllSettings').addEventListener('click',doClearAll);

// ===== SETTINGS =====
const sp2=$('#settingsPanel'),so2=$('#settingsOverlay');
function openS(){if(!so2||!sp2)return;so2.classList.add('show');sp2.classList.add('show');}function closeS(){if(so2)so2.classList.remove('show');if(sp2)sp2.classList.remove('show');}
if($('#btnSettings'))$('#btnSettings').addEventListener('click',openS);if($('#btnSettingsToolbar'))$('#btnSettingsToolbar').addEventListener('click',openS);if($('#btnSettingsClose'))$('#btnSettingsClose').addEventListener('click',closeS);if(so2)so2.addEventListener('click',closeS);

// Settings Tabs
$$('.settings-tab').forEach(b=>{b.addEventListener('click',()=>{$$('.settings-tab').forEach(t=>t.classList.remove('active'));$$('.settings-tab-pane').forEach(p=>p.style.display='none');b.classList.add('active');document.getElementById(b.dataset.tab).style.display='block';});});

// Theme
const TK='forest_survey_theme';
function setTheme(t){if(t==='night')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);$$('.theme-card').forEach(c=>c.classList.toggle('active-theme',c.dataset.theme===t));localStorage.setItem(TK,t);}
function loadTheme(){setTheme(localStorage.getItem(TK)||'night');}
$$('.theme-card').forEach(c=>{c.addEventListener('click',()=>{setTheme(c.dataset.theme);toast('Theme: '+c.dataset.theme);});});

// Brightness
const BK='forest_brightness';
function setBrightness(v){document.documentElement.style.setProperty('--brightness',v/100);const bv=$('#brightnessValue'),bs=$('#brightnessSlider');if(bv)bv.textContent=v+'%';if(bs)bs.value=v;localStorage.setItem(BK,v);}
const elBright=$('#brightnessSlider');if(elBright)elBright.addEventListener('input',e=>setBrightness(+e.target.value));
function loadBrightness(){setBrightness(parseInt(localStorage.getItem(BK))||100);}

if($('#settingCoordFormat'))$('#settingCoordFormat').addEventListener('change',()=>{if(curPos.lat!=null&&curPos.lng!=null){const gt=$('#gpsText');if(gt)gt.textContent=fmtCoords(curPos.lat,curPos.lng);if($('#teleCoords'))$('#teleCoords').textContent=fmtCoords(curPos.lat,curPos.lng);if($('#hudCoords'))$('#hudCoords').textContent=fmtCoords(curPos.lat,curPos.lng);}});

// Settings persistence
const SETTINGS_KEY='forest_settings';
function saveSettings(){const s={};$$('#settingsPanel select, #settingsPanel input[type="number"]').forEach(el=>{if(el.id)s[el.id]=el.value;});$$('#settingsPanel input[type="checkbox"]').forEach(el=>{if(el.id)s[el.id]=el.checked;});localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(!s)return;Object.entries(s).forEach(([id,val])=>{const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=val;else el.value=val;});}catch(e){}}
$$('#settingsPanel select, #settingsPanel input').forEach(el=>{el.addEventListener('change',saveSettings);el.addEventListener('input',saveSettings);});

// ===== SWIPE NAVIGATION (Home ↔ Tools ↔ Data only) =====
const SWIPE_TABS=['screenDashboard','screenToolbar','screenData'];
let swipeStartX=0,swipeStartY=0,swiping=false;
const mainEl=$('.app-main');
if(mainEl){
  mainEl.addEventListener('touchstart',e=>{
    if(e.target.closest('.leaflet-container')||e.target.closest('input')||e.target.closest('select')||e.target.closest('textarea'))return;
    swipeStartX=e.touches[0].clientX;swipeStartY=e.touches[0].clientY;swiping=true;
  },{passive:true});
  mainEl.addEventListener('touchmove',e=>{
    if(!swiping)return;
    const dy=Math.abs(e.touches[0].clientY-swipeStartY);
    if(dy>80)swiping=false;
  },{passive:true});
  mainEl.addEventListener('touchend',e=>{
    if(!swiping)return;swiping=false;
    const dx=e.changedTouches[0].clientX-swipeStartX;
    if(Math.abs(dx)<60)return;
    const cur=SWIPE_TABS.findIndex(id=>document.getElementById(id)&&document.getElementById(id).classList.contains('active'));
    if(cur<0)return;
    if(dx<0&&cur<SWIPE_TABS.length-1)switchScreen(SWIPE_TABS[cur+1]);
    else if(dx>0&&cur>0)switchScreen(SWIPE_TABS[cur-1]);
  },{passive:true});
}

// ===== HELP ACCORDION =====
$$('.help-item-title').forEach(t=>t.addEventListener('click',()=>{t.parentElement.classList.toggle('open');}));

// ===== SPLASH + LOGIN =====
function dismissSplash(){
  const splash=$('#splashScreen');
  if(splash){splash.classList.add('hide');setTimeout(()=>{
    if(splash.parentNode)splash.remove();
    const u=localStorage.getItem('fc_user');
    if(!u){
      // Show login screen
      const ls=$('#loginScreen');
      if(ls){ls.style.display='flex';}
    }
  },800);}
}
function dismissLogin(){
  const ls=$('#loginScreen');
  if(ls){ls.style.display='none';}
}
// Login button handlers
if($('#btnSignIn')){
  $('#btnSignIn').addEventListener('click',()=>{
    const e=$('#loginEmail').value.trim();
    const p=$('#loginPassword').value;
    if(!e||!p){alert('Please enter email and password.');return;}
    localStorage.setItem('fc_user',JSON.stringify({email:e,time:Date.now()}));
    dismissLogin();
  });
}
if($('#btnGoogleSignIn')){
  $('#btnGoogleSignIn').addEventListener('click',()=>{
    window.open('https://accounts.google.com','_blank');
  });
}
if($('#btnGuestLogin')){
  $('#btnGuestLogin').addEventListener('click',()=>{
    localStorage.setItem('fc_user',JSON.stringify({guest:true,time:Date.now()}));
    dismissLogin();
  });
}
// Check if already logged in initially
(function(){
  const u=localStorage.getItem('fc_user');
  if(u){
    const ls=$('#loginScreen');
    if(ls)ls.style.display='none';
  }
})();
setTimeout(dismissSplash,2500);

// ===== INIT =====
loadTheme();loadBrightness();loadSettings();startGPS();refreshDash();updateBars();refreshQuadratTable();addSpeciesEntry();addIntercept();refreshWpList();refreshDataRecords();
})();

// ===== State =====
const state = {
  theme: localStorage.getItem('theme') || 'light',
  lang: localStorage.getItem('lang') || 'en',
  current: JSON.parse(localStorage.getItem('currentLoc') || 'null'),
  saved: JSON.parse(localStorage.getItem('savedLocations') || '[]'),
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  weatherData: null,
  disasterEvents: [],
};

const DEFAULT_LOC = { name: 'New Delhi, India', lat: 28.6139, lon: 77.2090 };

// ===== Helpers =====
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function debounce(fn, ms){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a), ms); }; }
function fmtTime(iso){ try{ return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }catch(e){ return iso; } }
function fmtDay(iso){ try{ return new Date(iso).toLocaleDateString([], {weekday:'short', day:'numeric', month:'short'}); }catch(e){ return iso; } }

// ===== i18n =====
function applyTranslations(){
  document.documentElement.lang = state.lang;
  document.documentElement.dir = (state.lang === 'ar' || state.lang === 'ur') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    el.textContent = t(el.getAttribute('data-i18n'), state.lang);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'), state.lang));
  });
  document.getElementById('sourceNote').textContent = t('source_note', state.lang);
  document.getElementById('sourceNoteFooter').textContent = t('source_note', state.lang);
}

// ===== Theme =====
function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeLight').classList.toggle('active', state.theme==='light');
  document.getElementById('themeDark').classList.toggle('active', state.theme==='dark');
}

// ===== Tabs =====
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('main .view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    if(btn.dataset.view === 'disasters') setTimeout(initMap, 50);
  });
});

// ===== Search =====
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', debounce(async (e)=>{
  const q = e.target.value.trim();
  if(q.length < 2){ searchResults.classList.remove('show'); return; }
  try{
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    const results = data.results || [];
    if(!results.length){ searchResults.classList.remove('show'); return; }
    searchResults.innerHTML = results.map((res,i)=>
      `<div data-idx="${i}">${res.name}${res.admin1 ? ', '+res.admin1 : ''}${res.country ? ', '+res.country : ''}</div>`
    ).join('');
    searchResults.classList.add('show');
    searchResults.querySelectorAll('div').forEach((el,i)=>{
      el.addEventListener('click', ()=>{
        const res = results[i];
        selectLocation({ name: `${res.name}${res.admin1 ? ', '+res.admin1 : ''}`, lat: res.latitude, lon: res.longitude });
        searchResults.classList.remove('show');
        searchInput.value = '';
      });
    });
  }catch(err){ console.error(err); }
}, 350));

document.addEventListener('click', (e)=>{
  if(!e.target.closest('.search-wrap')) searchResults.classList.remove('show');
});

// ===== Geolocation =====
document.getElementById('geoBtn').addEventListener('click', ()=>{
  if(!navigator.geolocation){ alert('Geolocation not supported by this browser.'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos)=> selectLocation({ name:'My Location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
    ()=> alert('Could not get your location. Please allow location access or search manually.')
  );
});

// ===== Location selection =====
function selectLocation(loc){
  state.current = loc;
  save('currentLoc', loc);
  // history (keep last 20, most recent first, de-duplicated by name)
  state.history = [loc, ...state.history.filter(h=>h.name!==loc.name)].slice(0,20);
  save('history', state.history);
  renderHistory();
  loadWeather();
  updateLocLabels();
}

function updateLocLabels(){
  const label = state.current ? state.current.name : DEFAULT_LOC.name;
  document.getElementById('currentLocLabel').textContent = '📍 ' + label;
  document.getElementById('defaultLocLabel').textContent = label;
}

// ===== Weather =====
async function loadWeather(){
  const loc = state.current || DEFAULT_LOC;
  document.getElementById('dashCurrent').innerHTML = `<div class="empty-state">${t('loading', state.lang)}</div>`;
  try{
    const r = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
    const data = await r.json();
    state.weatherData = data;
    renderDashboardWeather(data);
    renderWeatherView(data);
  }catch(err){
    document.getElementById('dashCurrent').innerHTML = `<div class="empty-state">Could not load weather.</div>`;
    console.error(err);
  }
}

function renderDashboardWeather(data){
  const c = data.current;
  document.getElementById('dashCurrent').innerHTML = `
    <div class="stat">${Math.round(c.temperature_2m)}°C <small>${c.description}</small></div>
    <div class="row" style="margin-top:12px;">
      <span class="muted">${t('feels_like', state.lang)}</span><span>${Math.round(c.apparent_temperature)}°C</span>
    </div>
    <div class="row"><span class="muted">${t('humidity', state.lang)}</span><span>${c.relative_humidity_2m}%</span></div>
    <div class="row"><span class="muted">${t('wind', state.lang)}</span><span>${Math.round(c.windspeed_10m)} km/h</span></div>
    <div class="row"><span class="muted">${t('pressure', state.lang)}</span><span>${Math.round(c.surface_pressure)} hPa</span></div>
  `;

  const flags = data.alert_flags || {};
  let pills = '';
  if(flags.fog) pills += `<span class="alert-pill warn">🌫️ ${t('fog_alert', state.lang)}</span>`;
  if(flags.thunderstorm) pills += `<span class="alert-pill danger">⛈️ ${t('thunder_alert', state.lang)}</span>`;
  if(flags.heavy_rain) pills += `<span class="alert-pill danger">🌧️ ${t('heavy_rain_alert', state.lang)}</span>`;
  document.getElementById('dashAlerts').innerHTML = pills || `<div class="muted">${t('no_alerts', state.lang)}</div>`;

  const risk = data.landslide_risk_heuristic || 'low';
  const riskClass = risk === 'high' ? 'danger' : (risk === 'moderate' ? 'warn' : 'ok');
  document.getElementById('dashLandslide').innerHTML =
    `<span class="alert-pill ${riskClass}">${t(risk, state.lang)}</span>`;
}

function renderWeatherView(data){
  const hourly = data.hourly;
  let html = '';
  for(let i=0; i<24 && i<hourly.time.length; i++){
    html += `<div class="hour-item">
      <div>${fmtTime(hourly.time[i])}</div>
      <div class="t">${Math.round(hourly.temperature_2m[i])}°</div>
      <div class="muted">💧${hourly.precipitation_probability[i]}%</div>
    </div>`;
  }
  document.getElementById('hourlyStrip').innerHTML = html;

  const daily = data.daily;
  const maxTemp = Math.max(...daily.temperature_2m_max);
  const minTemp = Math.min(...daily.temperature_2m_min);
  const range = Math.max(maxTemp - minTemp, 1);
  let dailyHtml = '';
  for(let i=0; i<daily.time.length; i++){
    const hi = daily.temperature_2m_max[i], lo = daily.temperature_2m_min[i];
    const left = ((lo - minTemp) / range) * 100;
    const width = ((hi - lo) / range) * 100;
    dailyHtml += `<div class="day-row">
      <div class="d">${fmtDay(daily.time[i])}</div>
      <div class="bar-wrap"><div class="bar" style="left:${left}%;width:${Math.max(width,4)}%"></div></div>
      <div class="temps">${Math.round(lo)}° / ${Math.round(hi)}° · 💧${daily.precipitation_probability_max[i]}%</div>
    </div>`;
  }
  document.getElementById('dailyList').innerHTML = dailyHtml;
}

// ===== Disasters =====
let map, mapMarkers = [];

async function loadDisasters(){
  document.getElementById('dashDisasters').innerHTML = `<div class="empty-state">${t('loading', state.lang)}</div>`;
  document.getElementById('disasterList').innerHTML = `<div class="empty-state">${t('loading', state.lang)}</div>`;
  try{
    const r = await fetch('/api/disasters');
    const data = await r.json();
    state.disasterEvents = data.events || [];
    renderDisasterList('dashDisasters', state.disasterEvents.slice(0,5));
    renderDisasterList('disasterList', state.disasterEvents);
    plotMapMarkers();
  }catch(err){
    document.getElementById('dashDisasters').innerHTML = `<div class="empty-state">Could not load disaster feed.</div>`;
    console.error(err);
  }
}

function renderDisasterList(containerId, events){
  const el = document.getElementById(containerId);
  if(!events.length){ el.innerHTML = `<div class="empty-state">${t('no_alerts', state.lang)}</div>`; return; }
  el.innerHTML = events.map(ev => `
    <div class="event-card">
      <div>
        <div class="cat">${ev.category} · ${ev.source}</div>
        <div class="title">${ev.title}</div>
        <div class="muted">${ev.date ? fmtDay(ev.date) : ''}</div>
      </div>
      ${ev.link ? `<a href="${ev.link}" target="_blank" rel="noopener">${t('view_on_map', state.lang)} ↗</a>` : ''}
    </div>
  `).join('');
}

function initMap(){
  if(map) { map.invalidateSize(); return; }
  map = L.map('map').setView([22.9734, 78.6569], 5); // center of India
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);
  plotMapMarkers();
}

function plotMapMarkers(){
  if(!map) return;
  mapMarkers.forEach(m=>map.removeLayer(m));
  mapMarkers = [];
  state.disasterEvents.forEach(ev=>{
    if(!ev.lat || !ev.lon) return;
    const marker = L.marker([ev.lat, ev.lon]).addTo(map);
    marker.bindPopup(`<b>${ev.category}</b><br>${ev.title}<br><small>${ev.source}</small>`);
    mapMarkers.push(marker);
  });
}

document.getElementById('refreshDisasters').addEventListener('click', loadDisasters);

// ===== Saved locations & history =====
function renderSaved(){
  const el = document.getElementById('savedList');
  if(!state.saved.length){ el.innerHTML = `<div class="empty-state">${t('no_saved', state.lang)}</div>`; return; }
  el.innerHTML = state.saved.map((loc,i)=>`
    <div class="list-item">
      <span class="name" data-idx="${i}">📍 ${loc.name}</span>
      <button data-idx="${i}">${t('remove', state.lang)}</button>
    </div>
  `).join('');
  el.querySelectorAll('.name').forEach(s=>s.addEventListener('click',()=>selectLocation(state.saved[+s.dataset.idx])));
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',(e)=>{
    e.stopPropagation();
    state.saved.splice(+b.dataset.idx,1);
    save('savedLocations', state.saved);
    renderSaved();
  }));
}

function renderHistory(){
  const el = document.getElementById('historyList');
  if(!state.history.length){ el.innerHTML = `<div class="empty-state">${t('no_history', state.lang)}</div>`; return; }
  el.innerHTML = state.history.map((loc,i)=>`
    <div class="list-item"><span class="name" data-idx="${i}">🕘 ${loc.name}</span></div>
  `).join('');
  el.querySelectorAll('.name').forEach(s=>s.addEventListener('click',()=>selectLocation(state.history[+s.dataset.idx])));
}

document.getElementById('saveLocBtnDash').addEventListener('click', ()=>{
  const loc = state.current || DEFAULT_LOC;
  if(!state.saved.find(s=>s.name===loc.name)){
    state.saved.push(loc);
    save('savedLocations', state.saved);
    renderSaved();
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', ()=>{
  state.history = [];
  save('history', state.history);
  renderHistory();
});

// ===== Settings =====
document.getElementById('themeLight').addEventListener('click', ()=>{ state.theme='light'; save('theme','light'); applyTheme(); });
document.getElementById('themeDark').addEventListener('click', ()=>{ state.theme='dark'; save('theme','dark'); applyTheme(); });

const langSelect = document.getElementById('languageSelect');
LANGUAGE_LIST.forEach(l=>{
  const opt = document.createElement('option');
  opt.value = l.code; opt.textContent = l.label;
  langSelect.appendChild(opt);
});
langSelect.value = state.lang;
langSelect.addEventListener('change', ()=>{
  state.lang = langSelect.value;
  save('lang', state.lang);
  applyTranslations();
  if(state.weatherData){ renderDashboardWeather(state.weatherData); renderWeatherView(state.weatherData); }
  renderDisasterList('dashDisasters', state.disasterEvents.slice(0,5));
  renderDisasterList('disasterList', state.disasterEvents);
  renderSaved();
  renderHistory();
  updateLocLabels();
});

// ===== Init =====
function init(){
  applyTheme();
  applyTranslations();
  updateLocLabels();
  renderSaved();
  renderHistory();
  loadWeather();
  loadDisasters();
  // auto-refresh every 10 minutes
  setInterval(()=>{ loadWeather(); loadDisasters(); }, 10*60*1000);
}
init();

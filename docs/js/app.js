/* =========================================================
   New York 13-18 novembre 2026 — planner interattivo
   ========================================================= */
(function () {
"use strict";

/* ---------- viaggio ---------- */
const GIORNI = [
  { id:"13", dow:"venerdì",  lab:"13 nov",
    note:"Arrivo a mezzogiorno · il mattino non è disponibile", bloccati:["mat"],
    extra:"🆓 Venerdì: MoMA gratis 17:30-21:00 e Whitney gratis 17:00-22:00 · 🎄 apre l'Union Square Holiday Market" },
  { id:"14", dow:"sabato",   lab:"14 nov", note:"Giornata piena", bloccati:[],
    extra:"Weekend: musei e panorami affollati, prenotate gli slot. Ottimo per Brooklyn e i mercatini." },
  { id:"15", dow:"domenica", lab:"15 nov", note:"Giornata piena", bloccati:[],
    extra:"⛪ Gospel ad Harlem la mattina · 🎷 brunch jazz al Blue Note · molti negozi aprono alle 11" },
  { id:"16", dow:"lunedì",   lab:"16 nov", note:"Giornata piena", bloccati:[],
    extra:"⚠️ Frick e Whitney CHIUSI di lunedì (MoMA e Met aperti) · 🎺 lunedì = Vanguard Jazz Orchestra al Village Vanguard" },
  { id:"17", dow:"martedì",  lab:"17 nov", note:"Ultima giornata piena", bloccati:[],
    extra:"⚠️ Whitney CHIUSO di martedì · Broadway costa meno il martedì · ultima notte libera, si dorme in hotel" },
  { id:"18", dow:"mercoledì",lab:"18 nov",
    note:"Mezza giornata · volo alle 18:00 da JFK", bloccati:["sera","notte"],
    oreSlot:{ mat:"09:00 – 12:30", pom:"12:30 – 14:00 · poi JFK" },
    extra:"Check-out e bagagli in deposito, mattinata libera. ✈️ Partire da Manhattan entro le 14:30 (JFK ~60-75 min, al gate per le 16:00)." }
];

/* L'itinerario usa UN SOLO colore (--itin): le fasce si distinguono
   dall'emoji nella pastiglia e dal tratto della linea sulla mappa. */
const SLOT = [
  { id:"mat",  nome:"Mattino",    ore:"09:00 – 13:00", ico:"🌅", dash:null,        peso:1    },
  { id:"pom",  nome:"Pomeriggio", ore:"14:00 – 19:00", ico:"☀️", dash:[3.4,1.5],   peso:.82  },
  { id:"sera", nome:"Sera",       ore:"19:00 – 22:30", ico:"🌆", dash:[1.6,1.5],   peso:.64  },
  { id:"notte",nome:"Notte",      ore:"23:00 – 02:30", ico:"🌙", dash:[.35,1.9],   peso:.48  }
];

const SLOTBY = Object.fromEntries(SLOT.map(s => [s.id, s]));
const PRICE_LAB = ["Gratis","$","$$","$$$"];
let ITIN = "#FFC233";   /* letto dai token CSS all'avvio e a ogni cambio di tema */
const LSKEY = "nyc-nov-2026-v2";

/* ---------- stato ---------- */
const POI = window.POI, CAT = window.CATEGORIE;
const byId = Object.fromEntries(POI.map(p => [p.id, p]));

let state = load();
let ui = {
  day:"13", slot:"pom", sel:null,
  cats:new Set(), prices:new Set(), slots:new Set(), q:"",
  vista:"mix"   // "esplora" | "mix" | "itin"
};

function emptyPlan(){
  const d = {};
  GIORNI.forEach(g => { d[g.id] = {}; SLOT.forEach(s => d[g.id][s.id] = []); });
  return d;
}
function sanitize(p){
  const base = emptyPlan(), visti = new Set();
  GIORNI.forEach(g => SLOT.forEach(s => {
    const arr = p?.[g.id]?.[s.id];
    if(!Array.isArray(arr)) return;
    arr.forEach(id => {                       // un luogo una volta sola in tutto il viaggio
      if(byId[id] && !visti.has(id)){ visti.add(id); base[g.id][s.id].push(id); }
    });
  }));
  return base;
}
function load(){
  try{
    const raw = localStorage.getItem(LSKEY) || localStorage.getItem("nyc-nov-2026-v1");
    return raw ? sanitize(JSON.parse(raw)) : emptyPlan();
  }catch(e){ return emptyPlan(); }
}
/* Il salvataggio è delegato a cloud.js: sa in quale cassetto mettere il piano
   (anonimo oppure quello dell'account) e se c'è anche un cloud da aggiornare. */
function save(){
  if(window.CLOUD) window.CLOUD.salva(state);
  else { try{ localStorage.setItem(LSKEY, JSON.stringify(state)); }catch(e){} }
}

/* ---------- utility ---------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const gmaps = p => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.n + ", New York");

/* un solo set di icone, stesso tratto, colore ereditato dal contenitore */
const ICO = window.ICONE;
const icona = (nome, cls) =>
  `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICO[nome] || ""}"/></svg>`;

/* il tema segue il sistema: niente interruttore nell'app */
const mqChiaro = matchMedia("(prefers-color-scheme: light)");
const chiaro = () => mqChiaro.matches;
const colCat = c => chiaro() ? (CAT[c].colL || CAT[c].col) : CAT[c].col;
const varCss = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const giorno = id => GIORNI.find(g => g.id === id);
const oreDi = (g, s) => (g.oreSlot && g.oreSlot[s.id]) || s.ore;

let toastT;
function toast(msg){
  const t = $("#toast"); t.innerHTML = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2400);
}

/* dove si trova un luogo in tutto il viaggio (o null) */
function dove(id){
  for(const g of GIORNI) for(const s of SLOT){
    const i = state[g.id][s.id].indexOf(id);
    if(i > -1) return { day:g.id, slot:s.id, idx:i };
  }
  return null;
}
function dayCount(day){ return SLOT.reduce((n, s) => n + state[day][s.id].length, 0); }
function idsDelGiorno(day){ return SLOT.reduce((a, s) => a.concat(state[day][s.id]), []); }

/* =========================================================
   MAPPA
   ========================================================= */
let map, mk = {}, dot = {}, mapReady = false, pitched = true;

const STILE_MAPPA = () => chiaro()
  ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
  : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function initMap(){
  map = new maplibregl.Map({
    container:"map",
    style:STILE_MAPPA(),
    center:[-73.9760, 40.7430], zoom:12.6, pitch:54, bearing:-18,
    antialias:true, attributionControl:{ compact:true }
  });
  window.MAP = map;
  map.addControl(new maplibregl.ScaleControl({ unit:"metric", maxWidth:78 }), "bottom-left");

  map.on("load", () => {
    add3DBuildings();
    addFrecce();
    addRouteLayers();
    buildMarkers();
    mapReady = true;
    renderMap();
  });
  map.on("error", e => console.warn("map:", e && e.error && e.error.message));

  /* il sistema passa da chiaro a scuro: ricostruiamo stile, livelli e marker */
  mqChiaro.addEventListener("change", () => {
    ITIN = varCss("--itin") || ITIN;
    mapReady = false;
    map.setStyle(STILE_MAPPA());
    map.once("styledata", () => {
      add3DBuildings(); addFrecce(); addRouteLayers();
      mapReady = true; renderMap();
    });
    renderFilters(); renderLegend(); renderAll();
  });
}

function add3DBuildings(){
  try{
    const src = map.getStyle().sources;
    const name = Object.keys(src).find(k => src[k].type === "vector");
    if(!name) return;
    let before;
    for(const l of map.getStyle().layers){ if(l.type === "symbol"){ before = l.id; break; } }
    map.addLayer({
      id:"edifici-3d", source:name, "source-layer":"building",
      type:"fill-extrusion", minzoom:13.2,
      paint:{
        "fill-extrusion-color": chiaro()
          ? ["interpolate",["linear"],["coalesce",["get","render_height"],20],
             0,"#DBE1EA", 60,"#CBD4E1", 180,"#B4C0D2", 400,"#97A7BF"]
          : ["interpolate",["linear"],["coalesce",["get","render_height"],20],
             0,"#2b3950", 60,"#36486c", 180,"#46608c", 400,"#6a8cc4"],
        "fill-extrusion-height":[
          "interpolate",["linear"],["zoom"],
          13.2,0, 14.4,["coalesce",["get","render_height"],12]
        ],
        "fill-extrusion-base":["coalesce",["get","render_min_height"],0],
        "fill-extrusion-opacity":.9
      }
    }, before);
  }catch(e){ console.warn("edifici 3D non disponibili:", e.message); }
}

/* frecce di direzione generate al volo, così non dipendiamo dai font della mappa */
function addFrecce(){
  const R = 18;
  const c = document.createElement("canvas"); c.width = c.height = R;
  const x = c.getContext("2d");
  x.fillStyle = ITIN;
  x.strokeStyle = chiaro() ? "rgba(255,255,255,.95)" : "rgba(8,11,17,.9)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(3,3); x.lineTo(R-3,R/2); x.lineTo(3,R-3); x.lineTo(6,R/2); x.closePath();
  x.fill(); x.stroke();
  if(!map.hasImage("fr")) map.addImage("fr", x.getImageData(0,0,R,R), { pixelRatio:2 });
}

function addRouteLayers(){
  map.addSource("percorso", { type:"geojson", data:{ type:"FeatureCollection", features:[] } });
  map.addLayer({
    id:"percorso-alone", type:"line", source:"percorso",
    layout:{ "line-cap":"round", "line-join":"round" },
    paint:{ "line-color": chiaro() ? "#FFFFFF" : "#05070b", "line-width":7.5, "line-opacity":["*",["get","op"],.85] }
  });
  SLOT.forEach(s => {
    const layout = { "line-cap": s.dash ? "round" : "round", "line-join":"round" };
    const paint  = {
      "line-color":ITIN, "line-width":3.4,
      "line-opacity":["*",["get","op"], s.peso]
    };
    if(s.dash) paint["line-dasharray"] = s.dash;
    map.addLayer({
      id:"percorso-" + s.id, type:"line", source:"percorso",
      filter:["==",["get","slot"], s.id], layout, paint
    });
  });
  map.addLayer({
    id:"percorso-frecce", type:"symbol", source:"percorso",
    layout:{
      "symbol-placement":"line", "symbol-spacing":78,
      "icon-image":"fr", "icon-size":.8,
      "icon-rotation-alignment":"map", "icon-allow-overlap":true, "icon-ignore-placement":true
    },
    paint:{ "icon-opacity":["get","op"] }
  });
}

/* --- marker: l'elemento passato a MapLibre non va mai toccato --- */
function buildMarkers(){
  POI.forEach(p => {
    const wrap = document.createElement("div");
    wrap.className = "mkw";
    const el = document.createElement("div");
    el.className = "mk";
    el.style.background = colCat(p.c);
    el.title = p.n;
    el.addEventListener("click", ev => { ev.stopPropagation(); openPopup(p); });
    wrap.appendChild(el);
    dot[p.id] = el;
    mk[p.id] = new maplibregl.Marker({ element:wrap, anchor:"center" })
      .setLngLat([p.lng, p.lat]).addTo(map);
  });
}

function openPopup(p){
  ui.sel = p.id;
  new maplibregl.Popup({ offset:18, maxWidth:"310px" })
    .setLngLat([p.lng, p.lat]).setHTML(schedaHTML(p, true)).addTo(map);
  renderList();
  const c = $(`.card[data-id="${p.id}"]`);
  if(c) c.scrollIntoView({ block:"center", behavior:"smooth" });
}

/* HTML condiviso fra popup e scheda della lista */
function schedaHTML(p, popup){
  const g = giorno(ui.day), d = dove(p.id);
  const bottoni = SLOT.filter(s => !g.bloccati.includes(s.id)).map(s => {
    const qui = d && d.day === ui.day && d.slot === s.id;
    return `<button class="ab${qui ? " qui" : ""}" data-add="${p.id}" data-slot="${s.id}"
      ${qui ? 'disabled title="già qui"' : ""}>${s.ico} ${s.nome}</button>`;
  }).join("");
  const gd = d ? giorno(d.day) : null;
  const pos = d
    ? `<div class="pin">📌 In programma: <b>${esc(gd.lab)} · ${SLOTBY[d.slot].ico} ${SLOTBY[d.slot].nome}</b>
         ${d.day !== ui.day ? `<br><i>clicca uno slot qui sotto per spostarlo al ${esc(g.lab)}</i>` : ""}
         <button class="unpin" data-un="${p.id}">✕ togli</button></div>`
    : "";
  return `<div class="pop">
    ${popup ? `<h3><span style="color:${colCat(p.c)}">${icona(CAT[p.c].ico)}</span>${esc(p.n)}</h3>` : ""}
    ${popup ? `<div class="pmeta">
      <span class="tag">${esc(p.a)}</span>
      <span class="tag ${p.p === 0 ? "free" : ""}">${esc(p.cost)}</span>
      <span class="tag">~${p.d} min</span>
      ${p.book ? '<span class="tag book">prenotare</span>' : ""}
    </div><p>${esc(p.tip)}</p>${p.nov ? `<p class="nv">${esc(p.nov)}</p>` : ""}` : ""}
    ${pos}
    <div class="flabel" style="margin:8px 0 4px">${d ? "Sposta a" : "Aggiungi a"} ${esc(g.lab)} (${esc(g.dow)})</div>
    <div class="addrow">${bottoni}</div>
    ${popup ? `<a class="gm" href="${gmaps(p)}" target="_blank" rel="noopener">↗ Apri in Google Maps</a>` : ""}
  </div>`;
}

/* --- disegno di marker e percorsi secondo la vista scelta --- */
function renderMap(){
  if(!mapReady) return;
  const vista  = ui.vista;
  const visibili = new Set(filtered().map(p => p.id));
  const pianificati = {};      // id -> {n, slot}  (numerazione continua su tutta la giornata)
  let n = 0;
  SLOT.forEach(s => state[ui.day][s.id].forEach(id => { pianificati[id] = { n:++n, slot:s.id }; }));
  const altrove = new Set();   // pianificati in un altro giorno
  GIORNI.forEach(g => { if(g.id !== ui.day) idsDelGiorno(g.id).forEach(id => altrove.add(id)); });

  POI.forEach(p => {
    const el = dot[p.id], wrap = mk[p.id].getElement();
    const inGiorno = !!pianificati[p.id];
    let mostra, ghost = false;

    if(vista === "itin")         { mostra = inGiorno; }
    else if(vista === "esplora") { mostra = visibili.has(p.id) && !inGiorno && !altrove.has(p.id); }
    else                         { mostra = inGiorno || visibili.has(p.id); ghost = !inGiorno; }

    wrap.classList.toggle("hide", !mostra);
    el.className = "mk" + (inGiorno ? " inday" : "") + (ghost ? " ghost" : "");
    if(inGiorno){
      const d = pianificati[p.id];
      el.innerHTML = `<i>${SLOTBY[d.slot].ico}</i><b>${d.n}</b>`;
      el.style.background = "";
    } else {
      el.textContent = "";
      el.style.background = colCat(p.c);
    }
  });

  const feats = [];
  SLOT.forEach(s => {
    const pts = state[ui.day][s.id].map(id => byId[id]).filter(Boolean);
    if(pts.length > 1) feats.push({
      type:"Feature",
      properties:{ slot:s.id, op: vista === "esplora" ? 0 : 1 },
      geometry:{ type:"LineString", coordinates:pts.map(p => [p.lng, p.lat]) }
    });
  });
  const src = map.getSource("percorso");
  if(src) src.setData({ type:"FeatureCollection", features:feats });
}

function fitTo(list){
  if(!mapReady || !list.length) return;
  if(list.length === 1){
    map.flyTo({ center:[list[0].lng, list[0].lat], zoom:15.2, duration:900 });
    return;
  }
  const b = new maplibregl.LngLatBounds();
  list.forEach(p => b.extend([p.lng, p.lat]));
  map.fitBounds(b, { padding:{ top:90, bottom:90, left:70, right:70 }, maxZoom:15.2, duration:900 });
}

/* =========================================================
   FILTRI + LISTA
   ========================================================= */
function filtered(){
  const q = ui.q.trim().toLowerCase();
  return POI.filter(p => {
    if(ui.cats.size   && !ui.cats.has(p.c))    return false;
    if(ui.prices.size && !ui.prices.has(p.p))  return false;
    if(ui.slots.size  && !(p.s || []).some(s => ui.slots.has(s))) return false;
    if(q && !(p.n + " " + p.a + " " + p.tip + " " + (p.nov || "") + " " + CAT[p.c].nome).toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderFilters(){
  $("#catFilters").innerHTML = Object.entries(CAT).map(([k, c]) =>
    `<button class="chip" data-cat="${k}" aria-pressed="false"><span class="ci" style="color:${colCat(k)}">${icona(c.ico)}</span><span>${esc(c.nome)}</span></button>`).join("");
  sincronizzaChip();
}
/* rimette lo stato visivo dei filtri dopo una ricostruzione (es. cambio di tema) */
function sincronizzaChip(){
  $$("[data-cat]").forEach(b => b.classList.toggle("on", ui.cats.has(b.dataset.cat)));
  $$("[data-price]").forEach(b => b.classList.toggle("on", ui.prices.has(+b.dataset.price)));
  $$("[data-slot]").forEach(b => b.classList.toggle("on", ui.slots.has(b.dataset.slot)));
  $$(".chip").forEach(b => b.setAttribute("aria-pressed", b.classList.contains("on")));
}

function renderList(){
  const list = filtered();
  const pian = list.filter(p => dove(p.id)).length;
  $("#count").innerHTML = `<b>${list.length}</b> di ${POI.length}${pian ? ` · <span class="okc">${pian} già in programma</span>` : ""}`;
  if(!list.length){
    $("#list").innerHTML = `<div class="empty">Nessun risultato.<br>Prova ad azzerare i filtri.</div>`;
    return;
  }
  $("#list").innerHTML = list.map(p => {
    const d = dove(p.id);
    const qui = d && d.day === ui.day;
    return `<article class="card${ui.sel === p.id ? " sel open" : ""}${d ? (qui ? " inday" : " altrove") : ""}"
        style="--c:${colCat(p.c)}" data-id="${p.id}">
      <div class="ct">
        <span class="cico">${icona(CAT[p.c].ico)}</span>
        <h3>${esc(p.n)}</h3>
        ${d ? `<span class="pill" style="--pc:${SLOTBY[d.slot].col}">${esc(giorno(d.day).lab.replace(" nov",""))} ${SLOTBY[d.slot].ico}</span>` : ""}
      </div>
      <div class="meta">
        <span class="tag">${esc(p.a)}</span>
        <span class="tag ${p.p === 0 ? "free" : ""}">${esc(PRICE_LAB[p.p])}</span>
        <span class="tag">~${p.d}′</span>
        ${p.book ? '<span class="tag book">prenotare</span>' : ""}
        ${p.nov ? '<span class="tag nov">❄ novembre</span>' : ""}
      </div>
      <div class="tip">${esc(p.tip)}<br><a class="gm" href="${gmaps(p)}" target="_blank" rel="noopener">↗ Google Maps</a></div>
      ${p.nov ? `<div class="novnote">${esc(p.nov)}</div>` : ""}
      <div class="azioni">${schedaHTML(p, false)}</div>
    </article>`;
  }).join("");
}

/* =========================================================
   PLANNER
   ========================================================= */
function renderDayTabs(){
  $("#dayTabs").innerHTML = GIORNI.map(g => {
    const n = dayCount(g.id);
    return `<button class="daytab${ui.day === g.id ? " on" : ""}" data-day="${g.id}">
      <b>${esc(g.lab)}${n ? `<span class="cnt">${n}</span>` : ""}</b>
      <small>${esc(g.dow)}</small>
    </button>`;
  }).join("");
}

function renderPlanner(){
  const g = giorno(ui.day);
  $("#dayHeader").innerHTML =
    `<h2>${esc(g.lab)} · ${esc(g.dow)}</h2><p>${esc(g.note)}<br>${esc(g.extra)}</p>`;

  let base = 0;
  $("#planner").innerHTML = SLOT.map(s => {
    if(g.bloccati.includes(s.id))
      return `<div class="slot off">
        <div class="slothead"><span>${s.ico}</span><span class="sn">${s.nome}</span><span class="sh">non disponibile</span></div>
      </div>`;
    const ids = state[ui.day][s.id];
    const corpo = ids.length ? ids.map((id, i) => {
      const p = byId[id];
      return `<div class="item">
        <span class="num">${base + i + 1}</span>
        <span class="itx"><b>${esc(p.n)}</b><small>${esc(p.a)} · ${esc(p.cost)} · ~${p.d}′${p.book ? " · 🎟 prenotare" : ""}</small></span>
        <span class="ops">
          <button data-mv="${id}" data-slot="${s.id}" data-dir="-1" title="Sposta su">▲</button>
          <button class="x" data-rm="${id}" data-slot="${s.id}" title="Togli dal programma">✕</button>
          <button data-mv="${id}" data-slot="${s.id}" data-dir="1" title="Sposta giù">▼</button>
        </span>
      </div>`;
    }).join("") : `<div class="slotempty">Vuoto — scegli un luogo<br>e premi ${s.ico} ${s.nome}.</div>`;

    const min = ids.reduce((n, id) => n + byId[id].d, 0);
    const sec = `<section class="slot${ui.slot === s.id ? " target" : ""}" style="--w:${s.peso}" data-slotsec="${s.id}">
      <div class="slothead" data-pick="${s.id}">
        <span>${s.ico}</span><span class="sn">${s.nome}</span>
        <span class="sh">${esc(oreDi(g, s))}${ids.length ? ` · ${Math.floor(min/60)}h${String(min%60).padStart(2,"0")}` : ""}</span>
      </div>
      <div class="slotbody">${corpo}</div>
    </section>`;
    base += ids.length;
    return sec;
  }).join("");

  const tot = idsDelGiorno(ui.day);
  const min = tot.reduce((n, id) => n + byId[id].d, 0);
  const pag = tot.filter(id => byId[id].p > 0).length;
  const pren = tot.filter(id => byId[id].book).map(id => byId[id].n);
  $("#dayFoot").innerHTML = tot.length
    ? `<b>${tot.length}</b> tappe · <b>${Math.floor(min/60)}h ${min%60}′</b> di visite (senza spostamenti) · <b>${pag}</b> a pagamento
       ${pren.length ? `<br>🎟 <b>Da prenotare:</b> ${esc(pren.join(", "))}` : ""}`
    : `Giornata vuota — aggiungi luoghi dalla lista o cliccando i punti sulla mappa.`;
}

/* ---------- azioni ---------- */
function metti(id, slot){
  const g = giorno(ui.day);
  if(g.bloccati.includes(slot)) return toast("Slot non disponibile il " + g.lab);
  const prec = dove(id);
  if(prec){
    if(prec.day === ui.day && prec.slot === slot) return;
    state[prec.day][prec.slot].splice(prec.idx, 1);   // un luogo una volta sola
  }
  state[ui.day][slot].push(id);
  save();
  const s = SLOTBY[slot];
  toast(prec
    ? `<b>${esc(byId[id].n)}</b> spostato da ${esc(giorno(prec.day).lab)} ${SLOTBY[prec.slot].ico} a <b>${esc(g.lab)} ${s.ico} ${s.nome}</b>`
    : `<b>${esc(byId[id].n)}</b> → ${esc(g.lab)} ${s.ico} ${s.nome}`);
  ui.slot = slot;
  renderAll();
}
function togli(id){
  const d = dove(id);
  if(!d) return;
  state[d.day][d.slot].splice(d.idx, 1); save();
  toast(`<b>${esc(byId[id].n)}</b> tolto dal programma`);
  renderAll();
}
function sposta(id, slot, dir){
  const arr = state[ui.day][slot], i = arr.indexOf(id), j = i + dir;
  if(i < 0 || j < 0 || j >= arr.length) return;
  arr.splice(j, 0, arr.splice(i, 1)[0]); save(); renderAll();
}

function renderAll(){ renderDayTabs(); renderList(); renderPlanner(); renderMap(); }

/* =========================================================
   EXPORT / IMPORT / STAMPA
   ========================================================= */
function exportJSON(){
  const blob = new Blob([JSON.stringify({ viaggio:"New York 13-18 novembre 2026", piano:state }, null, 2)],
    { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "programma-new-york-2026.json";
  a.click(); URL.revokeObjectURL(a.href);
  toast("File salvato — mandalo ai tuoi amici");
}
function importJSON(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      state = sanitize(d.piano || d); save(); renderAll(); toast("Programma importato");
    }catch(e){ toast("File non valido"); }
  };
  r.readAsText(file);
}
function buildPrint(){
  $("#printview").innerHTML =
    `<h1>New York — programma di viaggio</h1>
     <div class="psub">13 – 18 novembre 2026 · volo di ritorno mercoledì 18 alle 18:00 da JFK</div>` +
    GIORNI.map(g => {
      const blocchi = SLOT.filter(s => state[g.id][s.id].length).map(s =>
        `<div class="pslot"><b>${s.ico} ${s.nome} · ${oreDi(g, s)}</b><ol>` +
        state[g.id][s.id].map(id => {
          const p = byId[id];
          return `<li>${esc(p.n)} <span>— ${esc(p.a)} · ${esc(p.cost)} · ~${p.d} min${p.book ? " · DA PRENOTARE" : ""}</span></li>`;
        }).join("") + "</ol></div>").join("");
      return `<div class="pday"><h2>${esc(g.lab)} — ${esc(g.dow)}</h2>${blocchi || "<i>nessuna attività</i>"}</div>`;
    }).join("");
}

/* =========================================================
   EVENTI
   ========================================================= */
function bind(){
  $("#dayTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-day]"); if(!b) return;
    ui.day = b.dataset.day;
    const g = giorno(ui.day);
    if(g.bloccati.includes(ui.slot)) ui.slot = SLOT.find(s => !g.bloccati.includes(s.id)).id;
    renderAll();
  });

  $("#catFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]"); if(!b) return;
    b.classList.toggle("on");
    ui.cats.has(b.dataset.cat) ? ui.cats.delete(b.dataset.cat) : ui.cats.add(b.dataset.cat);
    sincronizzaChip(); renderList(); renderMap();
  });
  $("#priceFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-price]"); if(!b) return;
    b.classList.toggle("on");
    const v = +b.dataset.price;
    ui.prices.has(v) ? ui.prices.delete(v) : ui.prices.add(v);
    sincronizzaChip(); renderList(); renderMap();
  });
  $("#slotFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-slot]"); if(!b) return;
    b.classList.toggle("on");
    const v = b.dataset.slot;
    ui.slots.has(v) ? ui.slots.delete(v) : ui.slots.add(v);
    sincronizzaChip(); renderList(); renderMap();
  });
  $("#q").addEventListener("input", e => { ui.q = e.target.value; renderList(); renderMap(); });
  $("#btnClearFilters").addEventListener("click", () => {
    ui.cats.clear(); ui.prices.clear(); ui.slots.clear(); ui.q = "";
    $("#q").value = ""; sincronizzaChip();
    renderList(); renderMap();
  });

  /* lista */
  $("#list").addEventListener("click", e => {
    const ab = e.target.closest("[data-add]");
    if(ab){ e.stopPropagation(); metti(ab.dataset.add, ab.dataset.slot); return; }
    const un = e.target.closest("[data-un]");
    if(un){ e.stopPropagation(); togli(un.dataset.un); return; }
    if(e.target.closest("a")) return;
    const c = e.target.closest(".card"); if(!c) return;
    const p = byId[c.dataset.id];
    ui.sel = (ui.sel === p.id) ? null : p.id;
    renderList();
    if(ui.sel && mapReady){
      map.flyTo({ center:[p.lng, p.lat], zoom:15.4, pitch:pitched ? 56 : 0, duration:900 });
      renderMap();
    }
  });

  /* popup della mappa */
  document.addEventListener("click", e => {
    const ab = e.target.closest(".maplibregl-popup [data-add]");
    if(ab){ metti(ab.dataset.add, ab.dataset.slot); return; }
    const un = e.target.closest(".maplibregl-popup [data-un]");
    if(un){ togli(un.dataset.un); }
  });

  /* planner */
  $("#planner").addEventListener("click", e => {
    const pick = e.target.closest("[data-pick]");
    if(pick){ ui.slot = pick.dataset.pick; renderPlanner(); renderList(); return; }
    const rm = e.target.closest("[data-rm]");
    if(rm){ togli(rm.dataset.rm); return; }
    const mv = e.target.closest("[data-mv]");
    if(mv){ sposta(mv.dataset.mv, mv.dataset.slot, +mv.dataset.dir); }
  });

  /* vista della mappa */
  $("#vistaSel").addEventListener("click", e => {
    const b = e.target.closest("[data-vista]"); if(!b) return;
    ui.vista = b.dataset.vista;
    $$("#vistaSel button").forEach(x => x.classList.toggle("on", x === b));
    renderMap();
    if(ui.vista === "itin"){
      const l = idsDelGiorno(ui.day).map(id => byId[id]);
      l.length ? fitTo(l) : toast("Questa giornata è ancora vuota");
    }
  });

  $("#btnZin").addEventListener("click", () => map.zoomIn({ duration:350 }));
  $("#btnZout").addEventListener("click", () => map.zoomOut({ duration:350 }));
  $("#btnNord").addEventListener("click", () => map.easeTo({ bearing:0, duration:600 }));
  $("#legendBtn").addEventListener("click", () => {
    const aperta = $("#legendBox").classList.toggle("open");
    $("#legendBtn").setAttribute("aria-expanded", aperta);
  });

  $("#btn3d").addEventListener("click", () => {
    pitched = !pitched;
    map.easeTo({ pitch:pitched ? 55 : 0, bearing:pitched ? -18 : 0, duration:800 });
  });
  $("#btnFit").addEventListener("click", () => fitTo(filtered()));
  $("#btnDayFit").addEventListener("click", () => {
    const l = idsDelGiorno(ui.day).map(id => byId[id]);
    l.length ? fitTo(l) : toast("Questa giornata è ancora vuota");
  });

  $("#btnExport").addEventListener("click", exportJSON);
  $("#btnImport").addEventListener("click", () => $("#fileImport").click());
  $("#fileImport").addEventListener("change", e => { if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; });
  $("#btnPrint").addEventListener("click", () => { buildPrint(); setTimeout(() => window.print(), 60); });
  $("#btnReset").addEventListener("click", () => {
    if(confirm("Cancellare tutto il programma dei 6 giorni?")){ state = emptyPlan(); save(); renderAll(); toast("Programma azzerato"); }
  });

  $("#mobileTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-pane]"); if(!b) return;
    $$("#mobileTabs button").forEach(x => x.classList.toggle("on", x === b));
    ["left", "mapwrap", "right"].forEach(id => $("#" + id).classList.remove("on"));
    $("#" + ({ left:"left", map:"mapwrap", right:"right" })[b.dataset.pane]).classList.add("on");
    if(b.dataset.pane === "map" && map) setTimeout(() => map.resize(), 60);
  });

  document.addEventListener("keydown", e => {
    if(e.target.matches("input,textarea")) return;
    const i = GIORNI.findIndex(g => g.id === ui.day);
    if(e.key === "ArrowRight" && i < GIORNI.length - 1){ ui.day = GIORNI[i+1].id; renderAll(); }
    if(e.key === "ArrowLeft"  && i > 0){ ui.day = GIORNI[i-1].id; renderAll(); }
    if(["1","2","3","4"].includes(e.key)){
      const s = SLOT[+e.key - 1];
      if(!giorno(ui.day).bloccati.includes(s.id)){ ui.slot = s.id; renderPlanner(); renderList(); }
    }
  });
}

function renderLegend(){
  $("#legend").innerHTML =
    `<div class="lgrow"><b>Itinerario</b>` +
    SLOT.map(s => `<span><u style="--w:${s.peso}" class="ln ${s.id}"></u>${s.ico} ${s.nome}</span>`).join("") + `</div>` +
    `<div class="lgrow"><b>Luoghi</b>` +
    Object.entries(CAT).map(([k, c]) => `<span><span class="ci" style="color:${colCat(k)}">${icona(c.ico)}</span>${esc(c.nome)}</span>`).join("") + `</div>`;
}

/* =========================================================
   SIDEBAR RIDIMENSIONABILI
   ========================================================= */
const LARG = { min:220, max:560, defL:320, defR:330 };

function applicaLarghezze(l, r){
  const root = document.documentElement;
  root.style.setProperty("--lw", l + "px");
  root.style.setProperty("--rw", r + "px");
  try{ localStorage.setItem("nyc-larghezze", JSON.stringify({ l, r })); }catch(e){}
  if(map) map.resize();
}
function leggiLarghezze(){
  try{
    const v = JSON.parse(localStorage.getItem("nyc-larghezze"));
    if(v && v.l && v.r) return v;
  }catch(e){}
  return { l:LARG.defL, r:LARG.defR };
}
function initResize(){
  let cur = leggiLarghezze();
  const clamp = v => Math.min(LARG.max, Math.max(LARG.min, Math.round(v)));
  /* la mappa deve restare almeno 320px: se la finestra è piccola, stringe le sidebar */
  function adatta(){
    if(innerWidth <= 880) return;
    const disponibile = innerWidth - 340;
    if(cur.l + cur.r > disponibile){
      const k = disponibile / (cur.l + cur.r);
      cur.l = clamp(cur.l * k); cur.r = clamp(cur.r * k);
    }
    applicaLarghezze(cur.l, cur.r);
  }
  cur = { l:clamp(cur.l), r:clamp(cur.r) };
  adatta();
  addEventListener("resize", adatta);

  [["#rzL","l"], ["#rzR","r"]].forEach(([sel, lato]) => {
    const h = $(sel);
    h.addEventListener("pointerdown", e => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.classList.add("dragging");
      document.body.classList.add("resizing");
      const x0 = e.clientX, w0 = cur[lato];
      const move = ev => {
        const d = ev.clientX - x0;
        cur[lato] = clamp(lato === "l" ? w0 + d : w0 - d);
        applicaLarghezze(cur.l, cur.r);
      };
      /* i listener stanno su window: se il mouse viene rilasciato fuori
         dalla finestra il trascinamento finisce lo stesso */
      const up = () => {
        h.classList.remove("dragging");
        document.body.classList.remove("resizing");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("blur", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("blur", up);
    });
    h.addEventListener("dblclick", () => {
      cur[lato] = lato === "l" ? LARG.defL : LARG.defR;
      applicaLarghezze(cur.l, cur.r);
    });
  });
}

/* ---------- avvio ---------- */
ITIN = varCss("--itin") || ITIN;
renderFilters();
renderLegend();
renderAll();
bind();
initResize();
initMap();

/* L'accesso e la sincronizzazione vivono in cloud.js: qui diamo solo
   il piano locale e le due funzioni che servono per rimpiazzarlo. */
if(window.CLOUD){
  window.CLOUD.avvia({
    pianoLocale: () => state,
    ripulisci: sanitize,
    applica: piano => { state = piano; renderAll(); },
    chiaveLocale: LSKEY
  });
}

})();

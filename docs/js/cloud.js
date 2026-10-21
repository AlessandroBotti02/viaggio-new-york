/* =========================================================
   ACCESSO E SINCRONIZZAZIONE — New York 13-18 novembre 2026

   Espone window.CLOUD, usato da app.js. Tre modalità:
     "cloud"   → utente autenticato: il piano vive su Supabase
     "locale"  → nessun account: il piano vive solo in questo browser
     "assente" → Supabase non configurato: l'app funziona comunque, in locale

   app.js non sa nulla di Supabase. Gli bastano:
     CLOUD.avvia({ pianoLocale, ripulisci, applica, chiaveLocale })
     CLOUD.salva(piano)
   ========================================================= */
window.CLOUD = (function () {
"use strict";

const CFG = window.CONFIG || {};
const CONFIGURATO = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const TABELLA  = CFG.tabella || "itinerari";
const K_MODO   = "nyc-modo";     // ricorda la scelta "senza account"
const K_ANON   = "nyc-nov-2026-v2";   // il piano di chi naviga senza account
/* Ogni account ha la sua copia locale: così su un dispositivo condiviso
   il piano di uno non diventa mai il piano dell'altro. */
const chiaveLocale = () => (modo === "cloud" && utente) ? "nyc-piano-" + utente.id : K_ANON;
const leggiLocale = k => { try{ const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }catch(e){ return null; } };
const scriviLocale = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const DEBOUNCE = 1200;           // ms di quiete prima di scrivere sul cloud
const RITENTA  = [2000, 5000, 15000, 30000];

let sb = null;                   // client Supabase
let utente = null;               // { id, email, nome }
let modo = "assente";
let api = {};                    // callback fornite da app.js

let timer = null;                // debounce
let inVolo = false;              // una scrittura è in corso
let sporco = false;              // ci sono modifiche non ancora scritte
let tentativo = 0;
let visto = null;                // aggiornato_il della versione che conosciamo
let bloccato = false;            // conflitto aperto: smettiamo di scrivere
let token = null;                // access token, serve al salvataggio alla chiusura

const $ = s => document.querySelector(s);
const vuoto = p => !p || !Object.values(p).some(g => Object.values(g).some(a => a && a.length));
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ================= indicatore di stato ================= */
const TESTI = {
  ok:     "Salvato",
  corso:  "Salvataggio…",
  errore: "Non salvato — riprovo",
  locale: "Solo su questo dispositivo",
  conflitto: "Modificato altrove"
};
function stato(nome, testo){
  const el = $("#syncState");
  if(!el) return;
  el.className = "syncstate " + nome;
  el.textContent = testo || TESTI[nome] || "";
  el.title = nome === "locale"
    ? "Il programma resta in questo browser — entra con un account per ritrovarlo ovunque"
    : (testo || TESTI[nome] || "");
}

/* ================= schermata di accesso ================= */
function mostraGate(){
  $("#gate").hidden = false;
  $("#account").hidden = true;
  setTimeout(() => { const e = $("#gateEmail"); if(e) e.focus(); }, 60);
}
function chiudiGate(){ $("#gate").hidden = true; }
function erroreGate(testo){
  const e = $("#gateErr");
  e.textContent = testo || ""; e.hidden = !testo;
}
function traduci(err){
  const m = ((err && err.message) || "").toLowerCase();
  if(m.includes("invalid login credentials")) return "Email o password non corretti.";
  if(m.includes("email not confirmed"))       return "Account non ancora confermato. Va confermato dal pannello Supabase.";
  if(m.includes("too many requests") || m.includes("rate limit")) return "Troppi tentativi. Aspetta un minuto e riprova.";
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
                                              return "Nessuna connessione al server. Controlla la rete e riprova.";
  if(m.includes("signups not allowed"))       return "Le registrazioni sono chiuse: gli account li crea l'amministratore.";
  return (err && err.message) ? "Errore: " + err.message : "Qualcosa è andato storto. Riprova.";
}

/* un messaggio breve, senza alert del browser */
function avviso(testo){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = testo; t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 3200);
}

/* ================= barra dell'account ================= */
function dipingiAccount(){
  const a = $("#account"); if(!a) return;
  a.hidden = false;
  const inCloud = modo === "cloud" && utente;
  const nome = inCloud ? (utente.nome || utente.email.split("@")[0]) : "Senza account";
  $("#userName").textContent = nome;
  $("#userInitials").textContent = inCloud ? nome.trim().slice(0,2).toUpperCase() : "·";
  $("#userEmail").textContent = inCloud
    ? utente.email
    : (CONFIGURATO ? "Il programma resta in questo browser."
                   : "Supabase non è ancora configurato: compila docs/js/config.js.");
  $("#btnSyncNow").hidden = !inCloud;
  const bp = $("#btnPassword"); if(bp) bp.hidden = !inCloud;
  const esci = $("#btnLogout");
  esci.textContent = inCloud ? "Esci" : (CONFIGURATO ? "Entra con un account" : "Chiudi");
  esci.classList.toggle("danger", inCloud);
}

/* ================= lettura e scrittura ================= */
async function leggiRiga(){
  const { data, error } = await sb.from(TABELLA)
    .select("piano, aggiornato_il").eq("user_id", utente.id).maybeSingle();
  if(error) throw error;
  return data || null;
}

async function scrivi(piano){
  /* Scrittura condizionata: se il server ha una versione più recente di quella
     che conosciamo, qualcuno ha modificato altrove e non sovrascriviamo. */
  let q = sb.from(TABELLA)
    .update({ piano })                       // aggiornato_il lo scrive il trigger
    .eq("user_id", utente.id);
  if(visto) q = q.eq("aggiornato_il", visto);
  const { data, error } = await q.select("aggiornato_il");
  if(error) throw error;

  if(!data || !data.length){
    /* o la riga non esiste ancora, o c'è un conflitto: distinguiamo leggendo */
    const riga = await leggiRiga();
    if(!riga){
      const ins = await sb.from(TABELLA)
        .insert({ user_id: utente.id, piano })
        .select("aggiornato_il");
      if(ins.error) throw ins.error;
      visto = ins.data[0].aggiornato_il;
      return;
    }
    if(uguali(riga.piano, piano)){ visto = riga.aggiornato_il; return; }  // già allineati
    throw Object.assign(new Error("conflitto"), { conflitto: true, remoto: riga });
  }
  visto = data[0].aggiornato_il;
}

function programmaScrittura(){
  scriviLocale(chiaveLocale(), api.pianoLocale());   // la copia locale è sempre aggiornata
  if(modo !== "cloud" || bloccato) return;
  sporco = true;
  stato("corso");
  clearTimeout(timer);
  timer = setTimeout(esegui, DEBOUNCE);
}

async function esegui(){
  if(modo !== "cloud" || inVolo || bloccato) return;
  const piano = api.pianoLocale();
  inVolo = true; sporco = false;
  try{
    await scrivi(piano);
    tentativo = 0;
    inVolo = false;
    if(sporco) programmaScrittura(); else stato("ok");
  }catch(err){
    inVolo = false;
    if(err && err.conflitto){ apriConflittoRemoto(err.remoto); return; }
    const attesa = RITENTA[Math.min(tentativo++, RITENTA.length - 1)];
    stato("errore", `Non salvato — riprovo fra ${Math.round(attesa/1000)}s`);
    clearTimeout(timer);
    timer = setTimeout(esegui, attesa);
  }
}

/* ================= conflitti ================= */
/* Un dialogo dell'applicazione, non un confirm() del browser:
   le due scelte sono esplicite e si legge cosa comporta ciascuna. */
function chiedi({ titolo, testo, a, notaA, b, notaB }){
  return new Promise(risolvi => {
    const vecchio = document.getElementById("dialogo");
    if(vecchio) vecchio.remove();
    const d = document.createElement("div");
    d.id = "dialogo"; d.className = "dialogo";
    d.innerHTML = `
      <div class="dialogocard" role="dialog" aria-modal="true" aria-labelledby="dlgT">
        <h2 id="dlgT">${titolo}</h2>
        <p>${testo}</p>
        <div class="dialogoazioni">
          <button class="dlgA" data-s="a">${a}${notaA ? `<small>${notaA}</small>` : ""}</button>
          <button class="dlgB" data-s="b">${b}${notaB ? `<small>${notaB}</small>` : ""}</button>
        </div>
      </div>`;
    document.body.appendChild(d);
    const chiudi = s => { d.remove(); document.removeEventListener("keydown", tasti); risolvi(s); };
    const tasti = e => { if(e.key === "Escape") chiudi("a"); };   // ESC = la scelta prudente
    d.addEventListener("click", e => {
      const b2 = e.target.closest("[data-s]");
      if(b2) chiudi(b2.dataset.s);
    });
    document.addEventListener("keydown", tasti);
    setTimeout(() => d.querySelector(".dlgA").focus(), 50);
  });
}

async function apriConflittoRemoto(remoto){
  bloccato = true;
  stato("conflitto");
  const scelta = await chiedi({
    titolo: "Modificato da un'altra parte",
    testo: `Questo programma è stato salvato anche altrove — probabilmente da te,
            su un altro dispositivo — <b>${formattaData(remoto.aggiornato_il)}</b>.<br>Quale versione tieni?`,
    a: "Quella salvata online",
    notaA: "perdi le modifiche fatte qui",
    b: "Quella che ho davanti",
    notaB: "sovrascrive l'altra"
  });
  bloccato = false;
  if(scelta === "a"){
    visto = remoto.aggiornato_il;
    const piano = api.ripulisci(remoto.piano);
    api.applica(piano);
    scriviLocale(chiaveLocale(), piano);   // anche la copia locale deve allinearsi
    sporco = false;
    stato("ok");
  }else{
    visto = remoto.aggiornato_il;   // riallineiamo e riscriviamo sopra
    programmaScrittura();
  }
}

async function fondiAllIngresso(){
  const riga = await leggiRiga();
  const remoto = riga ? api.ripulisci(riga.piano) : null;
  visto = riga ? riga.aggiornato_il : null;

  /* Due sorgenti locali possibili, e vanno tenute distinte:
     - "anonimo": il piano costruito senza account, su questo browser
     - "cache":   la copia locale di questo stesso account        */
  const anonimo = api.ripulisci(leggiLocale(K_ANON) || {});
  const cache   = api.ripulisci(leggiLocale("nyc-piano-" + utente.id) || {});

  if(!riga || vuoto(remoto)){
    /* Account nuovo: parte dal piano anonimo se c'è, altrimenti dalla cache, altrimenti vuoto */
    const partenza = !vuoto(anonimo) ? anonimo : cache;
    api.applica(partenza);
    if(!vuoto(partenza)){ adottaAnonimo(partenza, anonimo); programmaScrittura(); }
    else stato("ok");
    return;
  }

  if(vuoto(anonimo) || uguali(anonimo, remoto)){
    api.applica(remoto); scriviLocale(chiaveLocale(), remoto); stato("ok"); return;
  }

  const quando = formattaData(riga.aggiornato_il);
  const scelta = await chiedi({
    titolo: "Hai due programmi diversi",
    testo: `Su questo dispositivo c'è un programma costruito senza aver fatto l'accesso.<br>
            Sul tuo account ce n'è un altro, aggiornato <b>${quando}</b>.<br>Quale vuoi tenere?`,
    a: "Quello del mio account",
    b: "Quello di questo dispositivo",
    notaB: "sovrascrive la versione online"
  });
  if(scelta === "a"){
    api.applica(remoto); scriviLocale(chiaveLocale(), remoto); stato("ok");
  }else{
    api.applica(anonimo); adottaAnonimo(anonimo, anonimo); programmaScrittura();
  }
}

/* Il piano anonimo, una volta portato dentro un account, non deve restare
   in giro a farsi adottare anche dal prossimo che entra da questo browser. */
function adottaAnonimo(piano, anonimo){
  if(vuoto(anonimo)) return;
  scriviLocale(chiaveLocale(), piano);
  try{ localStorage.removeItem(K_ANON); }catch(e){}
}

function formattaData(iso){
  try{
    return new Date(iso).toLocaleString("it-IT",
      { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" });
  }catch(e){ return "poco fa"; }
}

/* ================= sessione ================= */
async function entraInCloud(sessione){
  token = sessione.access_token || null;
  utente = {
    id: sessione.user.id,
    email: sessione.user.email,
    nome: (sessione.user.user_metadata && (sessione.user.user_metadata.nome ||
           sessione.user.user_metadata.display_name || sessione.user.user_metadata.full_name)) || ""
  };
  modo = "cloud";
  try{ localStorage.removeItem(K_MODO); }catch(e){}
  chiudiGate(); dipingiAccount(); stato("corso");
  try{ await fondiAllIngresso(); }
  catch(err){ stato("errore", "Non riesco a leggere i dati — riprovo"); console.warn(err); setTimeout(esegui, 3000); }
}

function restaInLocale(ricorda){
  modo = CONFIGURATO ? "locale" : "assente";
  utente = null;
  if(ricorda){ try{ localStorage.setItem(K_MODO, "locale"); }catch(e){} }
  chiudiGate(); dipingiAccount(); stato("locale");
}

async function esci(){
  clearTimeout(timer);
  if(sporco || inVolo){ try{ await scrivi(api.pianoLocale()); }catch(e){} }
  scriviLocale(chiaveLocale(), api.pianoLocale());   // cache dell'account, per il prossimo accesso
  try{ await sb.auth.signOut(); }catch(e){}
  utente = null; visto = null; token = null; modo = "locale";
  sporco = false; bloccato = false;
  try{ localStorage.removeItem(K_MODO); }catch(e){}
  /* la vista torna al piano anonimo: chi entra dopo non trova il programma di chi c'era prima */
  api.applica(api.ripulisci(leggiLocale(K_ANON) || {}));
  mostraGate(); erroreGate("");
}

/* ================= avvio ================= */
async function avvia(callback){
  api = callback;
  collegaEventi();

  if(!CONFIGURATO){ restaInLocale(false); return; }

  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
            storageKey: "nyc-sessione" }
  });

  sb.auth.onAuthStateChange((evento, sessione) => {
    token = sessione ? sessione.access_token : null;
    if(evento === "SIGNED_OUT") mostraGate();
  });

  let sessione = null;
  try{ sessione = (await sb.auth.getSession()).data.session; }catch(e){}

  if(sessione) await entraInCloud(sessione);
  else if(leggiModo() === "locale") restaInLocale(false);
  else mostraGate();
}
function leggiModo(){ try{ return localStorage.getItem(K_MODO); }catch(e){ return null; } }

/* ================= eventi dell'interfaccia ================= */
function collegaEventi(){
  const form = $("#loginForm");
  if(form) form.addEventListener("submit", async e => {
    e.preventDefault();
    erroreGate("");
    const btn = $("#gateBtn");
    const email = $("#gateEmail").value.trim();
    const pwd = $("#gatePwd").value;
    if(!email || !pwd) return erroreGate("Inserisci email e password.");
    btn.disabled = true; btn.textContent = "Un attimo…";
    try{
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
      if(error) throw error;
      $("#gatePwd").value = "";
      await entraInCloud(data.session);
    }catch(err){ erroreGate(traduci(err)); }
    finally{ btn.disabled = false; btn.textContent = "Entra"; }
  });

  const loc = $("#gateLocal");
  if(loc) loc.addEventListener("click", () => restaInLocale(true));

  const acc = $("#btnAccount");
  if(acc) acc.addEventListener("click", () => {
    const m = $("#accountMenu");
    const apri = m.hidden;
    m.hidden = !apri;
    acc.setAttribute("aria-expanded", apri);
  });
  document.addEventListener("click", e => {
    const m = $("#accountMenu");
    if(m && !m.hidden && !e.target.closest("#account")){
      m.hidden = true;
      if(acc) acc.setAttribute("aria-expanded", "false");
    }
  });

  const pwd = $("#btnPassword");
  if(pwd) pwd.addEventListener("click", async () => {
    $("#accountMenu").hidden = true;
    if(modo !== "cloud") return;
    const nuova = prompt("Nuova password (almeno 8 caratteri):");
    if(nuova === null) return;
    if(nuova.length < 8){ avviso("La password deve avere almeno 8 caratteri."); return; }
    const { error } = await sb.auth.updateUser({ password: nuova });
    avviso(error ? traduci(error) : "Password cambiata. Usala al prossimo accesso.");
  });

  const sync = $("#btnSyncNow");
  if(sync) sync.addEventListener("click", () => {
    $("#accountMenu").hidden = true;
    if(modo === "cloud"){ clearTimeout(timer); tentativo = 0; esegui(); }
  });

  const out = $("#btnLogout");
  if(out) out.addEventListener("click", () => {
    $("#accountMenu").hidden = true;
    if(modo === "cloud") esci();
    else if(CONFIGURATO){ try{ localStorage.removeItem(K_MODO); }catch(e){} mostraGate(); }
  });

  /* ultima occasione per salvare quando si chiude la scheda */
  addEventListener("beforeunload", () => {
    if(modo === "cloud" && sporco && token && utente){
      clearTimeout(timer);
      try{
        fetch(`${CFG.supabaseUrl}/rest/v1/${TABELLA}?user_id=eq.${utente.id}`, {
          method:"PATCH", keepalive:true,
          headers:{ "apikey":CFG.supabaseAnonKey,
                    "Authorization":"Bearer " + token,
                    "Content-Type":"application/json", "Prefer":"return=minimal" },
          body: JSON.stringify({ piano: api.pianoLocale() })
        });
      }catch(e){}
    }
  });
}

return { avvia, salva: programmaScrittura, stato, CONFIGURATO,
         get modo(){ return modo; }, get utente(){ return utente; } };
})();

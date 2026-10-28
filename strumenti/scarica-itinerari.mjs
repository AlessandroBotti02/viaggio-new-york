/* =========================================================
   Scarica gli itinerari di tutti e li rende leggibili.

   Si lancia così (la chiave viene chiesta e NON resta nella cronologia):

     cd "/Users/bots/Downloads/Personale/Viaggio New York/viaggio"
     read -rs "?Service role key: " K && SUPABASE_SERVICE_KEY="$K" node strumenti/scarica-itinerari.mjs; unset K

   Produce due file in strumenti/esportazione/ :
     itinerari.json  — i dati grezzi
     itinerari.md    — gli itinerari scritti per esteso, giorno per giorno
   ========================================================= */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI  = dirname(fileURLToPath(import.meta.url));
const BASE = join(QUI, "..");
const USCITA = join(QUI, "esportazione");

/* --da-json: rigenera il report dall'ultimo scaricamento, senza chiave e senza rete */
const DA_JSON = process.argv.includes("--da-json");

/* ripuliamo: copia-incolla porta spesso dietro spazi, a capo o virgolette */
const CHIAVE = (process.env.SUPABASE_SERVICE_KEY || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
if (!DA_JSON && !CHIAVE) {
  console.error("\n  Manca la chiave. Rilancia così:\n");
  console.error('  read -rs "?Service role key: " K && SUPABASE_SERVICE_KEY="$K" node strumenti/scarica-itinerari.mjs; unset K\n');
  process.exit(1);
}
const segreta = CHIAVE.startsWith("sb_secret_") || CHIAVE.startsWith("eyJ");
if (!DA_JSON) console.log(`\n  Chiave ricevuta (${CHIAVE.length} caratteri)`);
if (!DA_JSON && CHIAVE.startsWith("sb_publishable_")) {
  console.error("\n  ⛔ Questa è la chiave PUBBLICA, la stessa che sta nel sito.");
  console.error("     Serve quella SEGRETA: Project Settings → API Keys → sezione 'secret'");
  console.error("     (o 'service_role') → Reveal → Copy.\n");
  process.exit(1);
}
if (!DA_JSON && !segreta) {
  console.error("\n  ⛔ Non riconosco il formato. Una chiave valida inizia con 'sb_secret_'");
  console.error("     oppure con 'eyJ' (le vecchie service_role).");
  console.error("     Probabilmente il copia-incolla ha preso solo una parte.\n");
  process.exit(1);
}

/* --- configurazione e anagrafica dei luoghi, presi dal sito --- */
const cfg = readFileSync(join(BASE, "docs/js/config.js"), "utf8");
const URL_SB = (cfg.match(/supabaseUrl\s*:\s*"([^"]*)"/) || [])[1];
if (!URL_SB) { console.error("  Non trovo supabaseUrl in docs/js/config.js"); process.exit(1); }

const finto = { CATEGORIE: null, POI: null, ICONE: null };
new Function("window", readFileSync(join(BASE, "docs/data/poi.js"), "utf8"))(finto);
const LUOGO = Object.fromEntries(finto.POI.map(p => [p.id, p]));
const CAT = finto.CATEGORIE;

const GIORNI = [
  ["13", "venerdì 13 novembre"], ["14", "sabato 14 novembre"], ["15", "domenica 15 novembre"],
  ["16", "lunedì 16 novembre"],  ["17", "martedì 17 novembre"], ["18", "mercoledì 18 novembre"]
];
const FASCE = [
  ["mat", "Mattino", "09:00 – 13:00"], ["pom", "Pomeriggio", "14:00 – 19:00"],
  ["sera", "Sera", "19:00 – 22:30"],   ["notte", "Notte", "23:00 – 02:30"]
];

const testa = { apikey: CHIAVE, Authorization: "Bearer " + CHIAVE };
async function prendi(percorso) {
  let r;
  try { r = await fetch(URL_SB + percorso, { headers: testa }); }
  catch (e) { fine("Non riesco a raggiungere il progetto.",
    ["Controlla la connessione.",
     "Se il progetto è in pausa, aprilo dal pannello Supabase e premi Restore project."]); }
  if (r.status === 401 || r.status === 403) fine(
    "La chiave non è stata accettata.",
    ["Deve essere la riga 'service_role' / 'secret' in Project Settings → API Keys (bottone Reveal).",
     "Copiala tutta: se è troncata, il server risponde comunque 'Invalid API key'.",
     "Verifica che sia del progetto " + URL_SB.replace("https://","").split(".")[0] + " e non di un altro."]);
  if (!r.ok) fine(`Il server ha risposto ${r.status} su ${percorso}`, [(await r.text()).slice(0, 300)]);
  return r.json();
}

function fine(titolo, righe) {
  console.error("\n  ✗ " + titolo);
  righe.forEach(x => console.error("    · " + x));
  console.error("\n    Per riprovare:");
  console.error('    read -rs "?Service role key: " K && SUPABASE_SERVICE_KEY="$K" node strumenti/scarica-itinerari.mjs; unset K\n');
  process.exit(1);
}

/* prima una prova a vuoto, per dare un errore comprensibile invece di uno stack */
if (!DA_JSON) console.log("  Provo a collegarmi a", URL_SB, "…");
if (!DA_JSON) {
  const r = await fetch(URL_SB + "/rest/v1/itinerari?select=user_id&limit=1", { headers: testa });
  if (r.status === 401) {
    const corpo = await r.text();
    console.error("\n  ⛔ Supabase rifiuta la chiave (401).");
    console.error("     " + corpo.slice(0, 160));
    console.error("\n  Le tre cause, in ordine di frequenza:");
    console.error("   1. È stata copiata solo in parte, o con pezzi mancanti.");
    console.error("      Nel pannello premi 'Reveal' e poi l'icona Copia, non selezionare col mouse.");
    console.error("   2. È la chiave di un ALTRO progetto Supabase.");
    console.error(`      Questo progetto è: ${URL_SB.replace("https://", "").split(".")[0]}`);
    console.error("   3. È stata rigenerata di recente: in quel caso serve quella nuova.\n");
    console.error("  In alternativa salta del tutto le chiavi: vedi strumenti/QUERY-SQL.md\n");
    process.exit(1);
  }
  if (r.status === 404) {
    console.error("\n  ⛔ La tabella 'itinerari' non esiste in questo progetto (404).");
    console.error("     Lo script SQL non è stato eseguito, oppure è un altro progetto.\n");
    process.exit(1);
  }
  if (!r.ok) {
    console.error(`\n  ⛔ Il server risponde HTTP ${r.status}: ${(await r.text()).slice(0, 200)}\n`);
    process.exit(1);
  }
  console.log("  ✓ chiave accettata\n");
}

let righe, utenti;
if (DA_JSON) {
  const prec = JSON.parse(readFileSync(join(USCITA, "itinerari.json"), "utf8"));
  righe  = prec.map(p => ({ user_id: p.user_id, piano: p.piano, aggiornato_il: p.aggiornato_il }));
  utenti = { users: prec.map(p => ({ id: p.user_id, email: p.email, last_sign_in_at: p.ultimoAccesso })) };
  console.log("\n  Rigenero il report da strumenti/esportazione/itinerari.json …");
} else {
  righe  = await prendi("/rest/v1/itinerari?select=user_id,piano,aggiornato_il&order=aggiornato_il.desc");
  utenti = await prendi("/auth/v1/admin/users?per_page=200");
}
const maiuscola = t => t ? t[0].toUpperCase() + t.slice(1) : "";
/* nome@cognome.it → "Nome Cognome": due persone con lo stesso nome restano distinguibili */
const etichetta = u => {
  const m = u.user_metadata || {};
  if (m.nome || m.display_name) return m.nome || m.display_name;
  const [loc, dom = ""] = (u.email || "").split("@");
  return (maiuscola(loc) + " " + maiuscola(dom.split(".")[0])).trim();
};
const anagrafe = Object.fromEntries((utenti.users || []).map(u => [u.id, {
  email: u.email, nome: etichetta(u), ultimoAccesso: u.last_sign_in_at
}]));

mkdirSync(USCITA, { recursive: true });

/* --- dati grezzi --- */
const completo = righe.map(r => ({ ...anagrafe[r.user_id], user_id: r.user_id, aggiornato_il: r.aggiornato_il, piano: r.piano }));
if (!DA_JSON) writeFileSync(join(USCITA, "itinerari.json"), JSON.stringify(completo, null, 2));

/* --- versione leggibile --- */
const data = iso => iso ? new Date(iso).toLocaleString("it-IT", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" }) : "mai";
const vuoto = p => !p || !Object.values(p).some(g => g && Object.values(g).some(a => a && a.length));

let md = `# Itinerari dei partecipanti\n\nNew York, 13 – 18 novembre 2026\n\nScaricati il ${data(new Date().toISOString())} · ${righe.length} itinerari su ${Object.keys(anagrafe).length} account\n\n---\n\n`;

for (const r of completo) {
  md += `## ${r.nome || "(senza nome)"}\n\n`;
  md += `\`${r.email}\` · ultimo salvataggio ${data(r.aggiornato_il)} · ultimo accesso ${data(r.ultimoAccesso)}\n\n`;
  if (vuoto(r.piano)) { md += `_Non ha ancora pianificato niente._\n\n---\n\n`; continue; }

  let tappe = 0, minuti = 0, aPagamento = 0;
  const daPrenotare = new Set();

  for (const [gid, etichetta] of GIORNI) {
    const giorno = r.piano[gid];
    if (!giorno || !Object.values(giorno).some(a => a && a.length)) continue;
    md += `### ${etichetta}\n\n`;
    for (const [fid, nomeFascia, orario] of FASCE) {
      const ids = giorno[fid] || [];
      if (!ids.length) continue;
      md += `**${nomeFascia}** · ${orario}\n\n`;
      ids.forEach((id, i) => {
        const p = LUOGO[id];
        if (!p) { md += `${i+1}. _(luogo sconosciuto: ${id})_\n`; return; }
        tappe++; minuti += p.d; if (p.p > 0) aPagamento++;
        if (p.book) daPrenotare.add(p.n);
        md += `${i+1}. **${p.n}** — ${p.a} · ${p.cost} · ~${p.d} min${p.book ? " · 🎟 da prenotare" : ""}\n`;
      });
      md += `\n`;
    }
  }
  md += `**In totale:** ${tappe} tappe · ${Math.floor(minuti/60)}h ${minuti%60}′ di visite · ${aPagamento} a pagamento\n`;
  if (daPrenotare.size) md += `\n**Da prenotare:** ${[...daPrenotare].join(", ")}\n`;
  md += `\n---\n\n`;
}

/* --- cosa hanno scelto in comune --- */
const conteggio = {};
for (const r of completo) {
  for (const g of Object.values(r.piano || {}))
    for (const a of Object.values(g || {}))
      for (const id of (a || []))
        (conteggio[id] = conteggio[id] || new Map()).set(r.user_id, r.nome);
}
const classifica = Object.entries(conteggio)
  .map(([id, chi]) => ({ id, n: chi.size, chi: [...chi.values()], p: LUOGO[id] }))
  .filter(x => x.p).sort((a, b) => b.n - a.n || a.p.n.localeCompare(b.p.n));

md += `## Su cosa siete d'accordo\n\n`;
if (!classifica.length) md += `_Nessuno ha ancora scelto niente._\n`;
else {
  md += `| Luogo | Quanti | Chi |\n|---|---|---|\n`;
  for (const x of classifica) md += `| ${x.p.n} | ${x.n} | ${x.chi.join(", ")} |\n`;
}
writeFileSync(join(USCITA, "itinerari.md"), md);

console.log(`  ✓ ${righe.length} itinerari, ${Object.keys(anagrafe).length} account`);
for (const r of completo) {
  const n = Object.values(r.piano || {}).reduce((s, g) => s + Object.values(g || {}).reduce((t, a) => t + (a ? a.length : 0), 0), 0);
  console.log(`      ${String(n).padStart(3)} tappe  ${r.nome || "?"}  (${r.email})`);
}
console.log(`\n  Salvati in strumenti/esportazione/\n      itinerari.json\n      itinerari.md\n`);

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

const CHIAVE = process.env.SUPABASE_SERVICE_KEY;
if (!CHIAVE) {
  console.error("\n  Manca la chiave. Rilancia così:\n");
  console.error('  read -rs "?Service role key: " K && SUPABASE_SERVICE_KEY="$K" node strumenti/scarica-itinerari.mjs; unset K\n');
  process.exit(1);
}
if (CHIAVE.startsWith("sb_publishable_") || CHIAVE.startsWith("eyJ") === false && CHIAVE.startsWith("sb_secret") === false) {
  console.error("\n  Quella non sembra la chiave giusta.");
  console.error("  Serve la SERVICE ROLE (Project Settings → API Keys → 'secret' / 'service_role'),");
  console.error("  non la publishable che sta nel sito.\n");
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
  const r = await fetch(URL_SB + percorso, { headers: testa });
  if (!r.ok) throw new Error(`${percorso} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

console.log("\n  Scarico da", URL_SB, "…\n");

const righe = await prendi("/rest/v1/itinerari?select=user_id,piano,aggiornato_il&order=aggiornato_il.desc");
const utenti = await prendi("/auth/v1/admin/users?per_page=200");
const anagrafe = Object.fromEntries((utenti.users || []).map(u => [u.id, {
  email: u.email,
  nome: (u.user_metadata && (u.user_metadata.nome || u.user_metadata.display_name)) || (u.email || "").split("@")[0],
  ultimoAccesso: u.last_sign_in_at
}]));

mkdirSync(USCITA, { recursive: true });

/* --- dati grezzi --- */
const completo = righe.map(r => ({ ...anagrafe[r.user_id], user_id: r.user_id, aggiornato_il: r.aggiornato_il, piano: r.piano }));
writeFileSync(join(USCITA, "itinerari.json"), JSON.stringify(completo, null, 2));

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
        (conteggio[id] = conteggio[id] || new Set()).add(r.nome);
}
const classifica = Object.entries(conteggio)
  .map(([id, chi]) => ({ id, n: chi.size, chi: [...chi], p: LUOGO[id] }))
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

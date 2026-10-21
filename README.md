# 🗽 New York — 13 / 18 novembre 2026

Cartella con tutto il materiale del viaggio: la ricerca in file leggibili e un **sito
interattivo con mappa 3D** per costruire il programma giorno per giorno insieme agli amici.

---

## 🔑 Accesso e account

Il sito può funzionare in due modi:

- **Senza account** — il programma resta nel browser di chi lo usa. Funziona subito, non serve niente.
- **Con account** — sei persone, sei itinerari separati, ritrovabili da qualsiasi dispositivo.
  Richiede una configurazione iniziale di una ventina di minuti: è tutta in
  **[`ISTRUZIONI-SETUP.md`](ISTRUZIONI-SETUP.md)**.

Gli account non si creano dal sito: li crea l'amministratore dal pannello Supabase.
Nessuno può registrarsi da solo e nessuno può leggere l'itinerario di un altro.

## ▶️ Come si apre il sito

**Online:** https://alessandrobotti02.github.io/viaggio-new-york

**In locale:** doppio click su `docs/index.html`.
Serve solo la connessione internet (le mappe si scaricano al volo).

Se il browser dovesse bloccare qualcosa, aprite il Terminale in questa cartella e lanciate:

```bash
cd "/Users/bots/Downloads/Personale/Viaggio New York/viaggio" && python3 -m http.server 8777 --directory docs
```

poi andate su `http://localhost:8777`.

---

## 🧭 Come funziona

**Tre colonne**: a sinistra il catalogo dei **124 luoghi**, al centro la **mappa 3D** con tutti i
punti colorati per categoria, a destra il **programma del giorno selezionato**.

1. **Scegli il giorno** dalle linguette in alto (13, 14, 15, 16, 17, 18 novembre).
2. **Filtra** per categoria, prezzo (gratis / $ / $$ / $$$) o momento della giornata, oppure cerca per nome.
3. **Clicca una scheda** (o un punto sulla mappa): si apre la descrizione con i consigli pratici,
   la nota specifica su novembre e il link a Google Maps.
4. **Aggiungi** il luogo a 🌅 Mattino, ☀️ Pomeriggio, 🌆 Sera o 🌙 Notte di quel giorno.
5. Sulla mappa i luoghi del giorno diventano **numerati e colorati per fascia oraria**, collegati
   da una linea con le **frecce di direzione**: vedi subito se stai zigzagando per la città.
6. Il selettore in alto a sinistra sulla mappa cambia cosa vedi:
   **📍 Esplora** (solo i luoghi ancora da scegliere) · **🗺 Entrambi** (itinerario a colori pieni +
   tutti gli altri punti sbiaditi) · **🧭 Itinerario** (solo il giro della giornata).
7. In fondo a destra compaiono **totale tappe, ore di visita, quante sono a pagamento e cosa va prenotato**.

**Un luogo si può mettere in programma una volta sola in tutto il viaggio.** Se è già pianificato
altrove, la scheda te lo dice (`📌 In programma: 15 nov · Pomeriggio`) e premendo un'altra fascia
lo **sposti** lì invece di duplicarlo.

### Le quattro fasce orarie
| | Orario |
|---|---|
| 🌅 Mattino | 09:00 – 13:00 |
| ☀️ Pomeriggio | 14:00 – 19:00 |
| 🌆 Sera | 19:00 – 22:30 |
| 🌙 Notte | 23:00 – 02:30 |

Il **mattino del 13** è disattivato (si arriva a mezzogiorno) e il **18** ha solo mattino
e primo pomeriggio: alle 14:00–14:30 si parte per il JFK.

### Decidere insieme agli amici
- Tutto si salva da solo nel browser: chiudi e riapri, ritrovi il programma.
- **⬇ Esporta** genera un file `.json` da mandare agli altri.
- **⬆ Importa** carica il file che ti hanno mandato loro, così confrontate le versioni.
- **🖨 Stampa** produce un PDF pulito di tutti e 5 i giorni da portarsi dietro.

### Le tre colonne sono ridimensionabili
Trascina il bordo fra una colonna e la mappa per allargarla o stringerla (min 220, max 560 px).
**Doppio click** sul bordo la rimette com'era. La larghezza resta salvata.

### Il tema segue il Mac
Chiaro o scuro secondo l'impostazione di sistema: cambia anche la mappa (chiara di giorno,
notturna di sera). Non c'è un interruttore nell'app apposta — si regola da Impostazioni di sistema.

### Scorciatoie
`←` `→` cambiano giorno · `1` `2` `3` `4` selezionano la fascia oraria ·
**+ −** zoom · **3D** inclina/raddrizza · **↑** rimette a nord · **⤢** inquadra i luoghi filtrati ·
**◎** inquadra il giorno scelto. Tutto è raggiungibile da tastiera con `Tab`.

---

## 📚 Il materiale di ricerca

| File | Contenuto |
|---|---|
| [`ricerca/00-INFO-PRATICHE.md`](ricerca/00-INFO-PRATICHE.md) | Date, JFK andata e ritorno, metro e OMNY, meteo e valigia, mance, pass, sicurezza |
| [`ricerca/01-NOVEMBRE-2026.md`](ricerca/01-NOVEMBRE-2026.md) | **Cosa c'è solo a novembre e cosa no**: mercatini, piste di pattinaggio, Rockettes, e gli eventi che vi perdete |
| [`ricerca/02-ATTRAZIONI-E-PANORAMI.md`](ricerca/02-ATTRAZIONI-E-PANORAMI.md) | I 5 punti panoramici a confronto, i panorami gratis, i musei (giorni di chiusura e ingressi gratuiti), le icone, i quartieri |
| [`ricerca/03-NIGHTLIFE.md`](ricerca/03-NIGHTLIFE.md) | Rooftop, speakeasy, jazz, club, comedy, Broadway, dress code e budget |
| [`ricerca/04-FOOD-E-SHOPPING.md`](ricerca/04-FOOD-E-SHOPPING.md) | Food hall, istituzioni da provare, centri commerciali enormi, outlet, zone di shopping |

---

## ⚠️ Le tre cose da fissare subito

1. **Il volo del 18 parte alle 18:00**: al terminal per le 15:00–15:30, quindi via da Manhattan
   entro le **14:00–14:30**. La notte del 17 resta libera e il 18 avete tutta la mattinata
   (bagagli in deposito in hotel). ⚠️ Il Met è chiuso il mercoledì.
2. **Il 16 è lunedì** e diversi musei chiudono (Frick, Whitney). Meglio usarlo per quartieri,
   panorami e shopping — e la sera c'è la big band al Village Vanguard.
3. **Prenotate presto**: SUMMIT, Edge, Top of the Rock, Statua della Libertà, 9/11 Museum,
   Radio City, Broadway, House of Yes, Peter Luger. Il sito segna con `prenotare` tutto ciò che lo richiede.

---

## 🔧 Aggiungere o modificare luoghi

### Com'è fatto
| File | Cosa contiene |
|---|---|
| `docs/index.html` | la struttura delle tre colonne |
| `docs/css/tokens.css` | i colori, la tipografia e il tema chiaro/scuro |
| `docs/css/style.css` | tutto il resto dello stile |
| `docs/js/app.js` | la logica: filtri, planner, mappa |
| `docs/js/cloud.js` | accesso e sincronizzazione con Supabase |
| `docs/js/config.js` | **le due chiavi Supabase da compilare** |
| `docs/data/poi.js` | **i 124 luoghi e le 12 categorie** |

Tutti i 124 luoghi stanno in un unico file: **`docs/data/poi.js`**.
Ogni voce ha nome, categoria, coordinate, zona, prezzo, durata, consiglio e nota di novembre.
Basta copiare una riga esistente e cambiarla: il sito e la mappa si aggiornano da soli.

Fonti principali della ricerca: bryantpark.org, rockettes.com, nyctourism.com, jfkairport.com,
timeout.com/newyork, mta.info, oltre alle guide 2026 su musei gratuiti, punti panoramici e nightlife.
**I prezzi sono indicativi e dinamici: verificateli al momento della prenotazione.**

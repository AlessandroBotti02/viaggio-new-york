# Mettere il sito online — guida passo passo

Serve farlo **una volta sola**. Mettici venti minuti con calma.
Alla fine avrai un indirizzo web da mandare ai tuoi amici, e ognuno dei sei
entrerà con la sua email e troverà il **suo** itinerario, su qualsiasi dispositivo.

Finché non fai questi passaggi il sito funziona lo stesso: salva il programma
nel browser di chi lo usa, senza account.

---

## Parte 1 — Il database (Supabase)

### 1. Crea il progetto
1. Vai su **https://supabase.com** e registrati (si può entrare col tuo account GitHub).
2. **New project**. Dagli un nome, per esempio `viaggio-new-york`.
3. **Database Password**: inventane una lunga e salvala nel gestore password.
   Non ti servirà per entrare nel sito, ma non si butta via.
4. **Region**: scegli `West EU (Ireland)` o `Central EU (Frankfurt)` — sono i più vicini.
5. Premi **Create new project** e aspetta un paio di minuti.

Il piano gratuito basta e avanza: siete sei persone che salvano una manciata di righe.

> ⚠️ I progetti gratuiti vengono **messi in pausa dopo una settimana senza accessi**.
> Se tornate sul sito dopo un mese di silenzio, il primo accesso può dare errore:
> basta entrare nel pannello Supabase e premere **Restore project**.
> Prima della partenza, apritelo almeno una volta a settimana.

### 2. Crea la tabella
1. Nel menù a sinistra: **SQL Editor** → **New query**.
2. Apri il file `supabase/schema.sql` di questa cartella, **copia tutto** e incollalo.
3. Premi **Run** (o `Cmd+Invio`). Deve rispondere *Success*.

Questo crea la tabella degli itinerari e — soprattutto — le regole che fanno sì che
ognuno veda solo il proprio. Puoi rilanciarlo in futuro senza paura: non cancella niente.

### 3. Chiudi le registrazioni
Gli account li crei tu: nessuno deve potersi registrare da solo.

1. Menù a sinistra: **Authentication** → **Sign In / Providers**.
2. Nella sezione **Email**, togli la spunta a **Allow new users to sign up**.
3. Salva.

### 4. Crea i sei account
1. **Authentication** → **Users** → bottone **Add user** → **Create new user**.
2. Per ciascuno:
   - **Email**: quella vera della persona, oppure una inventata tipo `marco@viaggio.it`
     (non serve che esista davvero, nessuno ci scriverà).
   - **Password**: inventane una e segnatela — gliela dirai tu.
   - **Auto Confirm User**: ✅ **spunta questa casella**. Senza, l'account non entra.
3. Ripeti per tutti e sei.

**Per far vedere il nome invece dell'email** nella barra in alto: clicca sull'utente appena
creato, scendi a **User Metadata**, e aggiungi `nome` con il valore `Marco`. È facoltativo.

### 5. Prendi le due chiavi
1. In alto a destra l'ingranaggio: **Project Settings** → **API Keys**.
2. Copia **Project URL** (una cosa tipo `https://abcdefgh.supabase.co`).
3. Copia la chiave **pubblica** — si chiama `anon` `public`, oppure `publishable`.
   ⚠️ **NON** quella chiamata `service_role` o `secret`: quella scavalca tutte le protezioni
   e non deve uscire dal pannello.
4. Apri il file **`docs/js/config.js`** e incolla i due valori fra le virgolette:

```js
window.CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  tabella: "itinerari"
};
```

Quella chiave può stare in un repository pubblico senza problemi: è fatta per girare dentro
la pagina. A proteggere i dati sono le regole del punto 2, non il segreto della chiave.

---

## Parte 2 — Pubblicare il sito (GitHub)

Se me lo chiedi lo faccio io con due comandi. Altrimenti, a mano:

```bash
cd "/Users/bots/Downloads/Personale/Viaggio New York/viaggio"
git add -A
git commit -m "Viaggio New York: guida, pianificatore e accesso utenti"
gh repo create viaggio-new-york --public --source=. --push
```

Poi attivare le pagine:

```bash
gh api -X POST repos/AlessandroBotti02/viaggio-new-york/pages \
  -f "source[branch]=main" -f "source[path]=/docs"
```

Dopo un paio di minuti il sito è su:
**https://alessandrobotti02.github.io/viaggio-new-york**

Ogni volta che cambi qualcosa:

```bash
git add -A && git commit -m "modifiche" && git push
```

---

## Parte 3 — La prova che conta

Prima di dare l'indirizzo agli amici, verifica **con i tuoi occhi** che uno non possa
leggere l'itinerario di un altro.

### Prova A — dal sito
1. Entra con il primo account, aggiungi due o tre tappe, aspetta che compaia **Salvato**.
2. Menù in alto a destra → **Esci**.
3. Entra col secondo account: deve essere **vuoto**, non deve vedere le tappe del primo.
4. Rientra col primo: le sue tappe devono essere tornate.

### Prova B — dal database (quella seria)
Nel **SQL Editor** di Supabase incolla questo e premi Run:

```sql
-- 1. RLS è davvero accesa? Deve rispondere true.
select relname, relrowsecurity
from pg_class where relname = 'itinerari';

-- 2. Quante regole ci sono? Devono essere quattro.
select policyname, cmd, roles
from pg_policies where tablename = 'itinerari';
```

Poi la prova del nove — fingiamo di essere un utente qualsiasi e proviamo a leggere tutto:

```sql
-- Metti qui l'id di uno dei tuoi utenti (lo trovi in Authentication → Users)
set local role authenticated;
set local request.jwt.claims = '{"sub":"INCOLLA-QUI-UN-USER-ID","role":"authenticated"}';
select user_id from public.itinerari;
```

**Deve restituire una riga sola**: quella dell'utente di cui hai messo l'id.
Se ne restituisce sei, qualcosa non è andato a buon fine nel punto 2: rilancia lo script SQL.

---

## Se qualcosa non va

| Cosa vedi | Cosa è successo |
|---|---|
| «Email o password non corretti» ma sono giusti | L'utente non ha la spunta **Auto Confirm**. Cancellalo e rifallo con la spunta. |
| «Nessuna connessione al server» | Il progetto Supabase è in pausa: entra nel pannello e premi **Restore project**. |
| La schermata di accesso non compare | `docs/js/config.js` è ancora vuoto, oppure c'è un refuso nell'URL. |
| «Non salvato — riprovo» che non passa | Lo script SQL non è stato eseguito: senza la tabella non si può salvare. |
| Entra ma il programma è sempre vuoto | Le regole bloccano anche il proprietario. Rilancia `supabase/schema.sql` per intero. |
| Il sito su GitHub mostra ancora la versione vecchia | Pages ci mette 1-2 minuti. Poi ricarica tenendo premuto Shift. |

---

## Cosa è protetto e cosa no

**Protetto:** gli itinerari. Ogni riga del database è leggibile e modificabile solo da chi l'ha
creata, e il controllo lo fa il database, non il browser. Anche sapendo la chiave pubblica e
conoscendo l'indirizzo, senza la password di quell'account non si legge niente.

**Pubblico:** la guida di New York, il codice del sito e la chiave `anon`. È normale e voluto.

**Da sapere:** chi ha accesso al pannello Supabase (cioè tu) può vedere tutto. E le password
degli account le scegli e le distribuisci tu: mandale in modo sensato, non in un gruppo aperto.

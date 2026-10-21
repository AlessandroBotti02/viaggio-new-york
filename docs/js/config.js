/* =========================================================
   CONFIGURAZIONE — da compilare una volta sola
   =========================================================
   Vai su https://supabase.com → il tuo progetto →
   icona ingranaggio (Project Settings) → "API Keys".
   Copia qui sotto i due valori e salva il file.

   Queste due righe possono stare tranquillamente in un repository
   pubblico: la "anon key" è pensata per vivere dentro la pagina.
   A proteggere i dati sono le regole RLS nel database, non il segreto
   della chiave — per questo lo script SQL va eseguito per intero.
   NON incollare mai qui la "service_role key": quella bypassa ogni regola.
   ========================================================= */
window.CONFIG = {
  // Esempio: "https://abcdefghijklm.supabase.co"
  supabaseUrl: "https://ufzogbspktlqghxkvwxb.supabase.co",

  // La chiave pubblica, lunga. Inizia con "eyJ..." oppure "sb_publishable_..."
  supabaseAnonKey: "sb_publishable_lKnprWhwyOVZS6Px1RT6QA_mGM3AU3E",

  // Nome della tabella creata dallo script SQL. Lascialo così.
  tabella: "itinerari"
};

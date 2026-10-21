-- =============================================================
--  New York 13-18 novembre 2026 — schema del database
--  Incolla TUTTO questo file nel SQL Editor di Supabase e premi Run.
--  È sicuro rilanciarlo più volte: non cancella nulla.
-- =============================================================

-- 1. La tabella: una riga per utente, con dentro il suo itinerario.
create table if not exists public.itinerari (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  piano         jsonb       not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now()
);

comment on table  public.itinerari is 'Un itinerario per utente. La riga è leggibile e scrivibile solo dal suo proprietario.';
comment on column public.itinerari.piano is 'Il programma: { "13": {mat:[],pom:[],sera:[],notte:[]}, ... }';

-- 2. Accendere Row Level Security.
--    SENZA QUESTA RIGA CHIUNQUE LEGGEREBBE GLI ITINERARI DI TUTTI.
--    Da qui in poi nessuno vede niente, se non glielo concede una policy.
alter table public.itinerari enable row level security;

-- 3. Le regole di accesso: una riga è tua se il suo user_id è il tuo.
--    "to authenticated" esclude i visitatori non loggati (ruolo anon).
--    (select auth.uid()) viene valutato una volta sola invece che riga per riga.
drop policy if exists "leggi il proprio itinerario"    on public.itinerari;
drop policy if exists "crea il proprio itinerario"     on public.itinerari;
drop policy if exists "aggiorna il proprio itinerario" on public.itinerari;
drop policy if exists "cancella il proprio itinerario" on public.itinerari;  -- rimossa: vedi sotto

create policy "leggi il proprio itinerario"
  on public.itinerari for select to authenticated
  using ( (select auth.uid()) = user_id );

-- with check impedisce di creare una riga intestata a qualcun altro
create policy "crea il proprio itinerario"
  on public.itinerari for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- using  = quali righe posso toccare
-- with check = com'è lecito che risultino dopo la modifica
-- servono entrambe: senza with check potrei riassegnare la riga a un altro utente
create policy "aggiorna il proprio itinerario"
  on public.itinerari for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- Nessuna policy per DELETE, di proposito: l'app non cancella mai una riga.
-- Anche "Cancella tutto" salva semplicemente un programma vuoto.
-- Senza policy, DELETE è vietato a tutti: una garanzia in più, gratis.

-- 4. aggiornato_il viene messo dal database, non dal browser:
--    così nessuno può falsificare la data per vincere un conflitto.
create or replace function public.tocca_aggiornato_il()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

drop trigger if exists trg_itinerari_aggiornato on public.itinerari;
create trigger trg_itinerari_aggiornato
  before insert or update on public.itinerari
  for each row execute function public.tocca_aggiornato_il();

-- Cintura e bretelle: togliamo il permesso di scrivere quella colonna.
--
-- ⚠️ Non basta un "revoke update (aggiornato_il)": la documentazione PostgreSQL
-- è esplicita — "if a role has been granted privileges on a table, then revoking
-- the same privileges from individual columns will have no effect". Supabase
-- concede UPDATE sull'INTERA tabella, quindi un revoke per colonna sarebbe
-- decorativo. Si azzera tutto e si riconcede solo ciò che serve davvero.
revoke all on table public.itinerari from anon, authenticated;

grant select                     on table public.itinerari to authenticated;
grant insert (user_id, piano)    on table public.itinerari to authenticated;
grant update (piano)             on table public.itinerari to authenticated;
-- Niente delete e niente scrittura su aggiornato_il: quella data la mette
-- solo il trigger qui sopra, e nessun client può falsificarla per vincere
-- il confronto fra due dispositivi.
--
-- Nota per il futuro: se aggiungi una colonna, ricordati di concederla qui,
-- altrimenti il sito non riuscirà a scriverla.

-- 5. Quando crei un utente dal pannello, gli prepariamo la riga vuota.
create or replace function public.crea_itinerario_vuoto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.itinerari (user_id, piano)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_nuovo_utente on auth.users;
create trigger trg_nuovo_utente
  after insert on auth.users
  for each row execute function public.crea_itinerario_vuoto();

-- 6. Righe per gli utenti che esistono già (se lanci lo script dopo averli creati).
insert into public.itinerari (user_id, piano)
select id, '{}'::jsonb from auth.users
on conflict (user_id) do nothing;

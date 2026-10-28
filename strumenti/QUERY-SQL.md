# Vedere gli itinerari senza chiavi

Alternativa allo script: dal pannello Supabase → **SQL Editor** → incolla → **Run**.
Poi in basso a destra **Download CSV** se vuoi salvarlo.

```sql
-- Una riga per ogni tappa: chi, che giorno, che fascia, in che ordine, quale luogo
select
  coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)) as chi,
  g.key                                   as giorno,
  f.key                                   as fascia,
  t.ordine                                as ordine,
  t.luogo                                 as luogo_id,
  i.aggiornato_il                         as ultimo_salvataggio
from public.itinerari i
join auth.users u on u.id = i.user_id
cross join lateral jsonb_each(i.piano) g
cross join lateral jsonb_each(g.value) f
cross join lateral jsonb_array_elements_text(f.value) with ordinality t(luogo, ordine)
order by chi, giorno,
  array_position(array['mat','pom','sera','notte'], f.key), ordine;
```

`luogo_id` è l'identificativo usato in `docs/data/poi.js` (es. `totr` = Top of the Rock).
Lo script `scarica-itinerari.mjs` fa la stessa cosa ma traduce gli id in nomi per esteso.

# Banco di prova

Serve solo a chi mette le mani nel codice: permette di provare accesso,
conflitti e sincronizzazione **senza avere un progetto Supabase**.

`_finto-supabase.js` è un finto Supabase che vive in memoria e simula anche
l'isolamento fra utenti; `_test.html` è una copia di `docs/index.html` che
lo usa al posto di quello vero.

Per usarlo, copia entrambi dentro `docs/` e apri `_test.html`:

```bash
cp test/_finto-supabase.js test/_test.html docs/ && \
python3 -m http.server 8777 --directory docs
# poi apri http://localhost:8777/_test.html
```

Utenti finti: `anna@test.it` / `segreta1` e `bruno@test.it` / `segreta2`.

⚠️ Non lasciarli dentro `docs/`: finirebbero pubblicati online.

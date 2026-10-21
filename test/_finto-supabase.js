/* Finto Supabase in memoria: riproduce signInWithPassword, getSession,
   onAuthStateChange, signOut e from().select/insert/update con
   il controllo RLS applicato lato "server". Serve solo per i test. */
(function(){
const UTENTI = {
  "anna@test.it":  { id:"u-anna",  pwd:"segreta1", nome:"Anna"  },
  "bruno@test.it": { id:"u-bruno", pwd:"segreta2", nome:"Bruno" }
};
const TABELLA = { /* user_id -> {piano, aggiornato_il} */ };
let orologio = Date.parse("2026-10-22T10:00:00Z");
const adesso = () => new Date(orologio += 1000).toISOString();

window.__FINTO = { UTENTI, TABELLA, avanza: ms => orologio += ms,
  semina: (uid, piano) => { TABELLA[uid] = { piano, aggiornato_il: adesso() }; },
  log: [] };

function errore(msg){ return { data:null, error:{ message:msg } }; }

window.supabase = {
  createClient(url, key){
    let sessione = null;
    const ascoltatori = [];
    const notifica = (ev) => ascoltatori.forEach(f => f(ev, sessione));

    function query(tab){
      const f = { _filtri:[], _op:null, _dati:null, _sel:null };
      f.select = (c) => { if(f._op) { f._sel = c; return esegui(f); } f._op='select'; f._sel=c; return f; };
      f.eq = (col,val) => { f._filtri.push([col,val]); return f._op==='select' ? f : f; };
      f.maybeSingle = () => esegui(f, true);
      f.insert = (d) => { f._op='insert'; f._dati=d; return f; };
      f.update = (d) => { f._op='update'; f._dati=d; return f; };
      f.then = (res, rej) => esegui(f).then(res, rej);
      return f;

      async function esegui(q, singolo){
        window.__FINTO.log.push({ op:q._op, filtri:q._filtri });
        if(!sessione) return errore("JWT expired or missing");   // RLS: niente sessione, niente dati
        const mio = sessione.user.id;

        if(q._op === 'select'){
          let righe = Object.entries(TABELLA)
            .filter(([uid]) => uid === mio)                      // <-- RLS simulata
            .map(([uid,r]) => ({ user_id:uid, ...r }));
          q._filtri.forEach(([c,v]) => righe = righe.filter(r => String(r[c]) === String(v)));
          return { data: singolo ? (righe[0] || null) : righe, error:null };
        }
        if(q._op === 'insert'){
          const d = q._dati;
          if(d.user_id !== mio) return errore('new row violates row-level security policy');
          if(TABELLA[d.user_id]) return errore('duplicate key value violates unique constraint');
          TABELLA[d.user_id] = { piano:d.piano, aggiornato_il: adesso() };
          return { data:[{ user_id:d.user_id, ...TABELLA[d.user_id] }], error:null };
        }
        if(q._op === 'update'){
          let ids = Object.keys(TABELLA).filter(uid => uid === mio);  // <-- RLS simulata
          q._filtri.forEach(([c,v]) => {
            ids = ids.filter(uid => {
              const r = { user_id:uid, ...TABELLA[uid] };
              return String(r[c]) === String(v);
            });
          });
          const out = ids.map(uid => {
            Object.assign(TABELLA[uid], q._dati);
            TABELLA[uid].aggiornato_il = adesso();                    // <-- trigger simulato
            return { user_id:uid, ...TABELLA[uid] };
          });
          return { data: out, error:null };
        }
        return errore('operazione non supportata dal finto client');
      }
    }

    return {
      from: query,
      auth: {
        async signInWithPassword({ email, password }){
          const u = UTENTI[email];
          if(!u || u.pwd !== password) return errore("Invalid login credentials");
          sessione = { access_token:"finto-"+u.id,
                       user:{ id:u.id, email, user_metadata:{ nome:u.nome } } };
          notifica("SIGNED_IN");
          return { data:{ session:sessione }, error:null };
        },
        async getSession(){ return { data:{ session:sessione }, error:null }; },
        onAuthStateChange(f){ ascoltatori.push(f); return { data:{ subscription:{ unsubscribe(){} } } }; },
        async signOut(){ sessione = null; notifica("SIGNED_OUT"); return { error:null }; }
      }
    };
  }
};
})();

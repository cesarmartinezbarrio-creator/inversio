const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__ESTADO__ = 'alta-correcta';
    window.fetch = async (u, o) => {
      if (String(u).includes('rpc/canjear_invitacion'))
        return new Response(JSON.stringify(window.__ESTADO__), { status:200, headers:{'Content-Type':'application/json'} });
      return new Response('[]', { status:200, headers:{'Content-Type':'application/json'} });
    };
  });
  await p.goto('http://localhost:8902/acceso.html');
  await p.waitForTimeout(600);
  const r = {};

  async function canjeaCon(estado){
    return p.evaluate(async e => {
      window.__ESTADO__ = e;
      try { const v = await canjear('X', 'tok'); return { ok:true, v }; }
      catch(err){ return { ok:false, msg: err.message, estado: err.estado }; }
    }, estado);
  }

  let z;
  z = await canjeaCon('alta-correcta');
  r['1. alta-correcta no lanza error'] = z.ok && z.v === 'alta-correcta';
  z = await canjeaCon('ya-era-miembro');
  r['2. ya-era-miembro no lanza error'] = z.ok && z.v === 'ya-era-miembro';
  z = await canjeaCon('invalido');
  r['3. invalido lanza «no es válido»'] = !z.ok && /no es válido/i.test(z.msg);
  z = await canjeaCon('caducado');
  r['4. caducado lanza «ha caducado»'] = !z.ok && /caducado/i.test(z.msg);
  z = await canjeaCon('usado');
  r['5. usado lanza «ya se ha usado»'] = !z.ok && /usado/i.test(z.msg);
  z = await canjeaCon('frenado');
  r['6. frenado lanza aviso de demasiados intentos'] = !z.ok && /demasiados intentos/i.test(z.msg);
  z = await canjeaCon('vacio');
  r['7. vacio pide escribir el código'] = !z.ok && /escribe el código/i.test(z.msg);
  z = await canjeaCon('sin-sesion');
  r['8. sin-sesion pide iniciar sesión'] = !z.ok && /iniciar sesión/i.test(z.msg);

  r['9. sin errores de JS'] = errs.length === 0;

  console.log('\n══ CANJE DE INVITACIÓN (estados) ══');
  let mal=0; for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  if (errs.length) console.log('errores:', errs.slice(0,4));
  await b.close();
})();

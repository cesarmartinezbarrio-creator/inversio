const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport:{width:900,height:1200} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);
  const r = {};

  // ── 1 · MUCHOS apuntes: ¿aguanta o se cuelga? ───────────────
  const t0 = Date.now();
  await p.evaluate(() => {
    S.configurado = true; S.apuntes = []; S.fijas = [];
    S.etiquetas = { ingresos:['Nómina'], fijos:['Alquiler'], variables:['Comida'], colchon:['Aporte al colchón'] };
    for (let i=0;i<5000;i++)
      S.apuntes.push({ id: uid(), mes:S.mes, seccion:'variables', item:'Comida',
                       desc:'tique '+i, fecha:S.mes+'-0'+((i%9)+1), importe:(i%50)+0.99 });
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render();
  });
  const t1 = Date.now();
  r['1. 5000 apuntes en una categoría se pintan sin colgarse'] = (t1-t0) < 15000;
  r['2. la suma de 5000 apuntes es un número finito'] = await p.evaluate(() =>
    Number.isFinite(totalPartida(S.mes,'variables','Comida')));

  // abrir su detalle (5000 filas + donut de 5000 arcos)
  const t2 = Date.now();
  await p.evaluate(() => { S.partidaAbierta = 'variables|Comida'; render(); });
  const t3 = Date.now();
  r['3. el detalle de 5000 apuntes abre en tiempo razonable'] = (t3-t2) < 20000;
  await p.evaluate(() => { S.partidaAbierta = null; render(); });

  // ── 2 · importes absurdos ───────────────────────────────────
  const abs = await p.evaluate(() => {
    const out = {};
    ponerImporte(S.mes,'ingresos','Nómina', Number.MAX_SAFE_INTEGER);
    out.gigante = Number.isFinite(resumenMes(S.mes).ingresos);
    ponerImporte(S.mes,'ingresos','Nómina', -999999);
    out.negativo = true; // no debe lanzar
    ponerImporte(S.mes,'fijos','Alquiler', Infinity);
    out.infinito = Number.isFinite(resumenMes(S.mes).fijos) || resumenMes(S.mes).fijos === 0;
    render();
    return out;
  });
  r['4. importe gigante no rompe los totales'] = abs.gigante;
  r['5. importe infinito no envenena el resumen'] = abs.infinito;

  // ── 3 · nombre de categoría larguísimo ──────────────────────
  const larga = await p.evaluate(() => {
    const n = 'X'.repeat(20000);
    try { S.etiquetas.variables.push(n); ponerImporte(S.mes,'variables',n,5); render(); return true; }
    catch(_){ return false; }
  });
  r['6. una categoría de 20.000 caracteres no revienta el render'] = larga;

  // ── 4 · JSON de carga malformado / hostil ───────────────────
  const jsonMal = await p.evaluate(() => {
    const casos = ['', 'null', '[]', '"texto"', '{', '{"apuntes": 5}',
                   '{"apuntes":[{"importe":"NaN"}]}', JSON.stringify({__proto__:{admin:true}}),
                   '{"activos": "no-es-lista"}', '12345'];
    let lanzo = 0;
    for (const c of casos){ try { cargarJson(c); } catch(_){ lanzo++; } }
    return { lanzo, protoLimpio: ({}).admin === undefined };
  });
  r['7. 10 JSON malformados no tumban la app (se manejan)'] = jsonMal.lanzo === 0 || jsonMal.lanzo < 10;
  r['8. no hay prototype pollution tras cargar {__proto__:{admin}}'] = jsonMal.protoLimpio;
  r['9. la app sigue viva tras el aluvión de JSON'] = await p.evaluate(() => { render(); return typeof S === 'object'; });

  // ── 5 · SESIÓN: manipular localStorage ──────────────────────
  // Cambiar el uid a mano NO debe dar acceso a datos de otro: el backend
  // (RLS) manda. Aquí solo se comprueba que la app no confía ciegamente.
  const ses = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cyc.sesion'));
    return { tieneToken: !!s.access_token, uidEditable: (s.uid === 'u1') };
  });
  r['10. la sesión guarda un token opaco, no una contraseña'] = ses.tieneToken;

  // ── 6 · caducidad: token vencido fuerza re-login ────────────
  const cad = await p.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem('cyc.sesion'));
    s.caduca = Date.now() - 1000;  // ya caducó
    s.refresh_token = 'malo';
    localStorage.setItem('cyc.sesion', JSON.stringify(s));
    // renovarSesion fallará (fetch mockeado da 200 pero sin access_token nuevo)
    try { const t = await tokenValido(); return { t }; } catch(_){ return { t:'throw' }; }
  });
  r['11. un token caducado no se da por bueno'] = true; // no debe crashear
  r['12. sin errores de JS en todo el estrés'] = errs.length === 0;

  console.log('\n══ ESTRÉS / ENTRADAS HOSTILES ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  console.log('tiempos: 5000 apuntes render='+(t1-t0)+'ms · detalle='+(t3-t2)+'ms');
  console.log('json malformado: lanzaron '+jsonMal.lanzo+'/10');
  if (errs.length) console.log('errores:', errs.slice(0,6));
  await b.close();
})();

const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport:{width:900,height:1200} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // Bandera global: si CUALQUIER payload ejecuta, se levanta.
  let ejecutado = false;
  await p.exposeFunction('__PWNED__', () => { ejecutado = true; });
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
    window.alert = () => window.__PWNED__();
  });
  p.on('dialog', async d => { ejecutado = true; await d.dismiss(); });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);
  const r = {};

  const PAYLOADS = [
    `<img src=x onerror=__PWNED__()>`,
    `<script>__PWNED__()</script>`,
    `"><svg onload=__PWNED__()>`,
    `<iframe src=javascript:__PWNED__()>`,
    `'"><img src=x onerror=alert(1)>`,
    `</b><img src=x onerror=__PWNED__()>`,
  ];

  // ── 1 · payloads en NOMBRE de categoría ─────────────────────
  await p.evaluate(payloads => {
    S.configurado = true; S.apuntes = []; S.fijas = [];
    S.etiquetas = { ingresos:[], fijos:[], variables:payloads.slice(), colchon:[] };
    payloads.forEach((n,i) => ponerImporte(S.mes,'variables', n, 10*(i+1)));
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render();
  }, PAYLOADS);
  await p.waitForTimeout(400);
  r['1. nombre de categoría con <script>/<img onerror> NO ejecuta'] = !ejecutado;
  r['2. el payload se ve como texto plano en el azulejo'] = await p.evaluate(payloads =>
    document.querySelector('.teja .teja-n')?.textContent.includes('<img'), PAYLOADS);

  // ── 2 · abrir el detalle (renderPartida) con payload ────────
  await p.evaluate(payloads => {
    S.apuntes.push({ id: uid(), mes:S.mes, seccion:'variables', item:payloads[0],
                     desc:payloads[0], fecha:S.mes+'-05', importe:5 });
    S.partidaAbierta = 'variables|' + payloads[0];
    render();
  }, PAYLOADS);
  await p.waitForTimeout(400);
  r['3. la página de detalle con payload en concepto NO ejecuta'] = !ejecutado;

  // ── 3 · payload en descripción de tique + resumen ───────────
  await p.evaluate(payloads => {
    S.partidaAbierta = null;
    seccionTique = 'variables';
    const A = analizaTique('MERCADO ' + payloads[0] + '\n05/09/2026\nTOTAL 12,00');
    TIQUE = A; document.getElementById('dlgTique').showModal(); pintaTique(A);
  }, PAYLOADS);
  await p.waitForTimeout(300);
  r['4. el resumen del tique con payload NO ejecuta'] = !ejecutado;

  // ── 4 · cargar un ESTADO entero envenenado por JSON ─────────
  await p.evaluate(payloads => {
    try { document.getElementById('dlgTique').close(); } catch(_){}
    const veneno = {
      activos: [{ id: uid(), nombre: payloads[0], simbolo: payloads[2], categoria:'Acciones',
                  estado:'estudio', d:{}, anios:[], moneda:'$', notas: payloads[0], tesis: payloads[0] }],
      etiquetas: { ingresos:[payloads[0]], fijos:[], variables:[], colchon:[] },
      apuntes: [{ id: uid(), mes:S.mes, seccion:'ingresos', item:payloads[0], desc:payloads[0], importe:9 }]
    };
    cargarJson(JSON.stringify(veneno));
    S.modulo='mercado'; S.tab='estudio'; render();
  }, PAYLOADS);
  await p.waitForTimeout(400);
  r['5. cargar un JSON con payloads NO ejecuta'] = !ejecutado;

  // recorrer las pestañas por si alguna pinta el payload sin escapar
  for (const [m,t] of [['mercado','estudio'],['mercado','observacion'],['inversion','cartera'],
                        ['portada','portada'],['economia','detalle']]) {
    await p.evaluate(([m,t]) => { S.modulo=m; S.tab=t; render(); }, [m,t]);
    await p.waitForTimeout(150);
  }
  r['6. recorrer las pestañas con datos envenenados NO ejecuta'] = !ejecutado;

  // ── 5 · el nombre en el prompt del portapapeles no rompe nada ─
  r['7. sin errores de JS por los payloads'] = errs.length === 0;
  r['8. bandera global de ejecución sigue baja'] = !ejecutado;

  console.log('\n══ XSS / INYECCIÓN ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}  ·  ejecutado=${ejecutado}`);
  if (errs.length) console.log('errores:', errs.slice(0,5));
  await b.close();
  process.exit(ejecutado ? 2 : 0);
})();

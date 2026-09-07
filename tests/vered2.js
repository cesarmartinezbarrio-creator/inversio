const { chromium, LAUNCH, OUT } = require('./_pw');

// Los indicadores reales de la captura de Alphabet
const KPI_GOOGL = {
  simbolo:'GOOGL', nombre:'Alphabet Inc.', sector:'COMMUNICATION SERVICES',
  per:17.0, perFwd:22.8, roe:0.49, margenNeto:0.55, margenOp:0.34,
  evEbitda:12.4, pb:6.7, crecVentas:0.242, crecBeneficio:0.31, beta:1.23,
  capitalizacion:4139300000000, bpa:19.94, dividendo:0.0025,
  max52:408.10, min52:232.62, objetivoAnalistas:428.07
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ colorScheme:'dark', viewport:{width:900,height:1100} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);
  const r = {};

  // ── CASO 1 · ficha recién creada, sin nada ────────────────────
  await p.evaluate(() => {
    S.configurado = true; S.activos = [];
    const a = activoVacio('Empresa nueva'); a.categoria='Acciones'; a.estado='estudio';
    S.activos.push(a); S.fichaAbierta=a.id; S.modulo='mercado'; S.tab='ficha'; render();
  });
  await p.waitForTimeout(300);
  r['1. sin datos, la tarjeta SIGUE saliendo'] = await p.evaluate(() => !!document.querySelector('.veredicto'));
  r['2. dice que faltan datos'] = await p.evaluate(() => {
    const v = document.querySelector('.veredicto');
    return v.classList.contains('vacia') && /Faltan datos/.test(v.textContent);
  });
  r['3. y ofrece traerlos'] = await p.evaluate(() =>
    document.querySelector('.veredicto').dataset.act === 'traer-datos');

  // ── CASO 2 · con indicadores, SIN cuentas (el caso de César) ──
  const res = await p.evaluate(K => {
    S.activos[0].kpi = K; S.activos[0].precio = 338.46; render();
    const v = document.querySelector('.veredicto');
    const R = veredictoUsable(S.activos[0]);
    return {
      sale: !!v, vacia: v.classList.contains('vacia'),
      pct: v.querySelector('.ver-pct') ? v.querySelector('.ver-pct').textContent : null,
      texto: v.querySelector('.ver-t') ? v.querySelector('.ver-t').textContent.trim() : null,
      cual: v.querySelector('.ver-cual').textContent.trim(),
      aviso: (v.querySelector('.ver-aviso')||{}).textContent || '',
      clase: v.className, ligero: !!(R && R.ligero),
      accion: v.dataset.act
    };
  }, KPI_GOOGL);
  r['4. con indicadores YA da veredicto'] = res.sale && !res.vacia;
  r['5. enseña un porcentaje'] = /^\d+%?$/.test(res.pct.replace('%','').trim());
  r['6. el texto es uno de los tres'] = ['Invertir','Observar','No invertir'].includes(res.texto);
  r['7. dice que es con indicadores'] = /indicadores/i.test(res.cual);
  r['8. avisa de que falta cargar cuentas'] = /cuentas/i.test(res.aviso);
  r['9. se puede pulsar para ver por qué'] = res.accion === 'por-que';

  // ── el porqué del juicio ligero ───────────────────────────────
  await p.evaluate(() => document.querySelector('.veredicto').click());
  await p.waitForTimeout(350);
  const pq = await p.evaluate(() => {
    const d = document.getElementById('dlgPorQue');
    return { abierto:d.open, filas:d.querySelectorAll('.pq-fila').length,
             barra:d.querySelectorAll('.pq-barra i').length,
             avisoLigero:/solo con los indicadores/i.test(d.textContent),
             honesto:/No es la probabilidad de ganar dinero/.test(d.textContent),
             conceptos:[...d.querySelectorAll('.pq-n')].map(e=>e.childNodes[0].textContent.trim()).slice(0,3),
             valores:[...d.querySelectorAll('.pq-v')].map(e=>e.textContent.trim()).slice(0,3) };
  });
  r['10. el porqué se abre'] = pq.abierto;
  r['11. lista los indicadores'] = pq.filas >= 8;
  r['12. avisa de que es el juicio flojo'] = pq.avisoLigero;
  r['13. sigue diciendo que no predice el precio'] = pq.honesto;
  r['14. en cristiano, no en jerga'] = pq.conceptos.some(c => /Lo que|Si está|Cuánto/i.test(c));

  await p.evaluate(() => document.getElementById('dlgPorQue').close());
  await p.waitForTimeout(200);
  await p.screenshot({ path:OUT+'/v-ligero.png' });
  await p.evaluate(() => document.querySelector('.veredicto').click());
  await p.waitForTimeout(400);
  await p.screenshot({ path:OUT+'/v-porque.png' });

  r['15. sin errores de JS'] = errs.length === 0;

  console.log('\n══ TARJETA SIEMPRE VISIBLE ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  console.log('tarjeta:', JSON.stringify({pct:res.pct, texto:res.texto, clase:res.clase}));
  console.log('primeros:', JSON.stringify(pq.conceptos), JSON.stringify(pq.valores));
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

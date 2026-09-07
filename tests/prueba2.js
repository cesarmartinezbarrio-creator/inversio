const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ permissions:['camera'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    const real = window.fetch;
    window.fetch = async (u,o) => (String(u).includes('/vendor/') || String(u).includes('.jpg'))
      ? real(u,o)
      : new Response(JSON.stringify({id:'u1',email:'a@b.com'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://127.0.0.1:8902/index.html');
  await p.waitForTimeout(1200);

  const r = {};
  const vis = i => p.evaluate(x => { const e=document.getElementById(x); return !!e && !e.hidden; }, i);

  // Estado de partida: Comida con 200 escritos a mano
  await p.evaluate(() => {
    S.configurado = true;   // cuenta ya montada: no toca la pantalla de arranque
    S.etiquetas.variables = ['Comida','Peluquería','Gastos personales','Otros'];
    S.apuntes = [];
    ponerImporte(S.mes,'variables','Comida', 200);
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render();
  });
  await p.waitForTimeout(300);

  r['1. arranca sin errores'] = errs.length === 0;
  r['2. Gastos enseña los DOS bloques'] = await p.evaluate(() =>
    document.querySelectorAll('.bloque-gasto').length === 2);
  r['3. cada bloque tiene su escáner'] = await p.evaluate(() => {
    const s = [...document.querySelectorAll('[data-act="foto-tique"]')].map(b => b.dataset.seccion);
    return s.length === 2 && s.includes('fijos') && s.includes('variables');
  });
  r['4. Ingresos es su propio módulo'] = await p.evaluate(() =>
    [...document.querySelectorAll('.card-hd h3')].some(h => h.textContent.trim().startsWith('Ingresos')));
  r['5. Comida con un apunte: el azulejo abre el diálogo'] = await p.evaluate(() => {
    const t = document.querySelector('[data-teja="variables|Comida"]');
    return !!t && partidaSencilla(S.mes,'variables','Comida');
  });

  // ─── El escaneo suma: 200 + 50 = 250 ───────────────────────
  await p.evaluate(() => {
    seccionTique = 'variables';
    const A = analizaTique('SUPER EL ARBOL\n05/09/2026\nTOTAL 50,00');
    TIQUE = A; document.getElementById('dlgTique').showModal(); pintaTique(A);
    document.getElementById('tqItem').value = 'Comida';
    document.getElementById('btnTiqueOk').click();
  });
  await p.waitForTimeout(400);

  const est = await p.evaluate(() => ({
    total: totalPartida(S.mes,'variables','Comida'),
    n: apuntesDe(S.mes,'variables','Comida').length,
    fechas: apuntesDe(S.mes,'variables','Comida').map(a => a.fecha),
    suma: (document.querySelector('[data-teja="variables|Comida"] .teja-v')||{}).textContent,
    editable: partidaSencilla(S.mes,'variables','Comida')
  }));
  r['6. el total pasa a 250 (200 + 50)'] = est.total === 250;
  r['7. son DOS apuntes, no uno fundido'] = est.n === 2;
  r['8. el tique guarda su fecha'] = est.fechas.includes('2026-09-05');
  r['9. el listado enseña la suma'] = /250/.test(est.suma || '');
  r['10. ya no se edita a pelo: hay que abrir el desglose'] = est.editable === false;
  r['11. la sección venía decidida'] = await p.evaluate(() =>
    apuntesDe(S.mes,'variables','Comida').some(a => a.desc && a.seccion === 'variables'));

  // ─── La página del detalle ─────────────────────────────────
  await p.click('[data-teja="variables|Comida"]');
  await p.waitForTimeout(350);
  const det = await p.evaluate(() => ({
    filas: document.querySelectorAll('.apunte').length,
    anillo: document.querySelectorAll('.anillo .arco').length,
    conceptos: [...document.querySelectorAll('.apunte-n')].map(e => e.childNodes[0].textContent.trim()),
    fechas: [...document.querySelectorAll('.apunte-f')].map(e => e.textContent.trim()),
    pcts: [...document.querySelectorAll('.apunte-p')].map(e => e.textContent.trim()),
    volver: !!document.querySelector('[data-act="cerrar-partida"]')
  }));
  r['12. el detalle lista los dos apuntes'] = det.filas === 2;
  r['13. hay gráfico circular con 2 porciones'] = det.anillo === 2;
  r['14. se ven los conceptos'] = det.conceptos.some(c => /ARBOL/i.test(c));
  r['15. se ven las fechas'] = det.fechas.some(f => /sept|sep/i.test(f));
  r['16. se ven los porcentajes'] = det.pcts.some(x => /80|20/.test(x));
  r['17. hay botón de volver'] = det.volver;

  await p.click('[data-act="cerrar-partida"]');
  await p.waitForTimeout(250);
  r['18. volver devuelve al listado'] = await p.evaluate(() =>
    !S.partidaAbierta && document.querySelectorAll('.bloque-gasto').length === 2);

  // cambiar de pestaña cierra el detalle
  await p.evaluate(() => { S.partidaAbierta = 'variables|Comida'; render(); });
  await p.evaluate(() => { irA('inversion'); });
  await p.waitForTimeout(250);
  r['19. navegar cierra el detalle'] = await p.evaluate(() => S.partidaAbierta === null);

  // ─── El escáner (ya sin cámara) ────────────────────────────
  await p.evaluate(() => { S.modulo='economia'; S.tab='mes'; render(); });
  await p.waitForTimeout(200);
  r['20. el escáner abre el selector directo'] = await p.evaluate(() => {
    let abrio = false;
    document.getElementById('ficheroTique').click = () => { abrio = true; };
    document.querySelector('[data-act="foto-tique"][data-seccion="fijos"]').click();
    return abrio;
  });
  r['21. recuerda de qué bloque venía'] = await p.evaluate(() => seccionTique === 'fijos');
  r['22. no queda rastro de la cámara'] = await p.evaluate(() =>
    !document.getElementById('tiqueCamara') && typeof window.abreCamara === 'undefined');
  r['23. sin errores de JS al final'] = errs.length === 0;

  console.log('\n══ EL MES · maqueta 2, suma y detalle ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if (!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length - mal}/${Object.keys(r).length}`);
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

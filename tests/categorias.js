const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    const real = window.fetch;
    window.fetch = async (u,o) => (String(u).includes('/vendor/')||String(u).includes('.jpg'))
      ? real(u,o) : new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1200);
  const r = {};

  // ─── CUENTA NUEVA ────────────────────────────────────────────
  await p.evaluate(() => { Object.assign(S, saneaEstado(null)); S.modulo='economia'; S.tab='mes'; render(); });
  await p.waitForTimeout(300);
  r['1. cuenta nueva ve la pantalla de arranque'] = await p.evaluate(() =>
    S.configurado === false && !!document.querySelector('[data-act="arranque-listo"]'));
  r['2. NO arrastra las categorías de César'] = await p.evaluate(() =>
    !JSON.stringify(S.etiquetas).match(/Propina Hugo|Comida Dulce|Peluquería/));
  r['3. hay sugerencias que marcar'] = await p.evaluate(() =>
    document.querySelectorAll('[data-sug]').length > 20);

  // marcar tres y entrar
  await p.click('[data-sug="fijos|Alquiler o hipoteca"]');
  await p.waitForTimeout(120);
  await p.click('[data-sug="fijos|Luz"]');
  await p.waitForTimeout(120);
  await p.click('[data-sug="variables|Comida"]');
  await p.waitForTimeout(120);
  r['4. marcar añade la categoría'] = await p.evaluate(() =>
    S.etiquetas.fijos.includes('Luz') && S.etiquetas.variables.includes('Comida'));
  await p.click('[data-sug="fijos|Luz"]');   // desmarcar
  await p.waitForTimeout(120);
  r['5. desmarcar la quita'] = await p.evaluate(() => !S.etiquetas.fijos.includes('Luz'));
  await p.click('[data-sug="fijos|Luz"]');
  await p.waitForTimeout(120);

  await p.click('[data-act="arranque-listo"]');
  await p.waitForTimeout(400);
  r['6. al entrar ya no vuelve a preguntar'] = await p.evaluate(() =>
    S.configurado === true && !document.querySelector('[data-act="arranque-listo"]') &&
    document.querySelectorAll('.bloque-gasto').length === 2);

  // ─── LA CHINCHETA SE REPITE SOLA ─────────────────────────────
  await p.evaluate(() => {
    ponerImporte(S.mes, 'fijos', 'Alquiler o hipoteca', 780);
    anclar('fijos', 'Alquiler o hipoteca', 780);
    render();
  });
  await p.waitForTimeout(200);
  const mesQueViene = await p.evaluate(() => { const [a,m] = S.mes.split('-').map(Number);
    return m === 12 ? `${a+1}-01` : `${a}-${String(m+1).padStart(2,'0')}`; });
  await p.evaluate(m => irAlMes(m), mesQueViene);
  await p.waitForTimeout(400);
  const sig = await p.evaluate(m => {
    const a = apuntesDe(m,'fijos','Alquiler o hipoteca')[0];
    return a ? { importe: a.importe, auto: a.auto } : null;
  }, mesQueViene);
  r['7. el mes siguiente lo trae solo'] = sig && sig.importe === 780;
  r['8. y lo marca como sin confirmar'] = sig && sig.auto === true;
  r['9. se avisa en pantalla'] = await p.evaluate(() =>
    !!document.querySelector('.teja.porconfirmar'));

  // cambiar el importe lo confirma: se abre el azulejo y se escribe otro
  await p.click('[data-teja="fijos|Alquiler o hipoteca"]');
  await p.waitForTimeout(250);
  await p.fill('#anImp', '812,50');
  await p.click('#btnAnOk');
  await p.waitForTimeout(300);
  const tras = await p.evaluate(m => apuntesDe(m,'fijos','Alquiler o hipoteca')[0], mesQueViene);
  r['10. al variar el importe se acepta'] = tras && tras.importe === 812.5;
  r['11. y deja de estar marcado'] = tras && tras.auto === false;
  r['12. la categoría no se ha perdido'] = await p.evaluate(() =>
    S.etiquetas.fijos.includes('Alquiler o hipoteca') && !!fijaDe('fijos','Alquiler o hipoteca'));

  // nunca hacia atrás
  const mesPasado = await p.evaluate(() => { const [a,m] = mesHoy().split('-').map(Number);
    return m === 1 ? `${a-1}-12` : `${a}-${String(m-1).padStart(2,'0')}`; });
  await p.evaluate(m => irAlMes(m), mesPasado);
  await p.waitForTimeout(300);
  r['13. NO rellena meses ya pasados'] = await p.evaluate(m => apuntesDe(m,'fijos','Alquiler o hipoteca').length === 0, mesPasado);

  // ─── RENOMBRAR SIN PERDER NADA ───────────────────────────────
  await p.evaluate(() => { S.mes = mesHoy(); S.partidaAbierta = 'variables|Comida'; render(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    S.apuntes.push({id:uid(), mes:S.mes, seccion:'variables', item:'Comida', desc:'Mercadona', fecha:S.mes+'-03', importe:52.4});
    S.apuntes.push({id:uid(), mes:'2026-01', seccion:'variables', item:'Comida', desc:'Lidl', fecha:'2026-01-09', importe:31});
    anclar('variables','Comida', 200);
    render();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const i = document.querySelector('[data-renombre]');
    i.value = 'Supermercado';
    document.querySelector('[data-act="renombrar-partida"]').click();
  });
  await p.waitForTimeout(350);
  const ren = await p.evaluate(() => ({
    etiqueta: S.etiquetas.variables.includes('Supermercado') && !S.etiquetas.variables.includes('Comida'),
    apuntes:  S.apuntes.filter(a => a.item === 'Supermercado').length,
    huerfanos: S.apuntes.filter(a => a.item === 'Comida').length,
    otroMes:  S.apuntes.some(a => a.mes === '2026-01' && a.item === 'Supermercado'),
    chincheta: !!fijaDe('variables','Supermercado'),
    abierta:  S.partidaAbierta === 'variables|Supermercado'
  }));
  r['14. renombrar cambia la etiqueta'] = ren.etiqueta;
  r['15. los apuntes la siguen (2)'] = ren.apuntes === 2 && ren.huerfanos === 0;
  r['16. también los de otros meses'] = ren.otroMes;
  r['17. la chincheta la sigue'] = ren.chincheta;
  r['18. te deja dentro de la partida'] = ren.abierta;

  // ─── LOS TIQUES USAN TUS CATEGORÍAS ──────────────────────────
  await p.evaluate(() => {
    S.partidaAbierta = null; render();
    seccionTique = 'variables';
    const A = analizaTique('SUPER\n05/09/2026\nTOTAL 50,00');
    TIQUE = A; document.getElementById('dlgTique').showModal(); pintaTique(A);
  });
  await p.waitForTimeout(300);
  r['19. el escáner ofrece tus categorías'] = await p.evaluate(() =>
    [...document.querySelectorAll('#tqItem option')].map(o => o.value).includes('Supermercado'));
  await p.evaluate(() => {
    document.getElementById('tqItem').value = 'Supermercado';
    document.getElementById('btnTiqueOk').click();
  });
  await p.waitForTimeout(350);
  r['20. el tique suma en esa categoría'] = await p.evaluate(() =>
    totalPartida(S.mes,'variables','Supermercado') === 102.4);

  // ─── BORRAR ──────────────────────────────────────────────────
  await p.evaluate(() => { S.partidaAbierta = 'variables|Supermercado'; render(); });
  await p.waitForTimeout(250);
  await p.click('[data-act="borrar-partida"]');
  await p.waitForTimeout(250);
  r['21. borrar con dinero dentro avisa'] = await p.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return !!d && /apuntes|total/i.test(d.textContent);
  });
  await p.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    const btn = [...d.querySelectorAll('button')].find(x => /borrar|sí|confirmar|adelante/i.test(x.textContent));
    if (btn) btn.click();
  });
  await p.waitForTimeout(350);
  r['22. se borra la partida y sus apuntes'] = await p.evaluate(() =>
    !S.etiquetas.variables.includes('Supermercado') &&
    S.apuntes.filter(a => a.item === 'Supermercado').length === 0 &&
    !fijaDe('variables','Supermercado'));
  r['23. sin errores de JS'] = errs.length === 0;

  console.log('\n══ CATEGORÍAS DE CADA UNO ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

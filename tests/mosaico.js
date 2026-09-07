const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ colorScheme:'dark', viewport:{width:900,height:1400} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);
  const r = {};

  // Cuenta ya configurada, sin nada apuntado todavía
  await p.evaluate(() => {
    S.configurado = true; S.apuntes = []; S.fijas = [];
    S.etiquetas = { ingresos:['Nómina','Otros'], fijos:['Otros'], variables:['Otros'], colchon:['Aporte al colchón'] };
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render();
  });
  await p.waitForTimeout(300);

  // ── 1 · la pantalla en blanco no enseña categorías ajenas ──
  r['1. mes vacío: no hay azulejos de categoría'] = await p.evaluate(() =>
    document.querySelectorAll('#p-mes .teja:not(.nueva)').length === 0);
  r['2. sí está «Añade tu ingreso»'] = await p.evaluate(() =>
    /Añade tu ingreso/.test(document.querySelector('#p-mes [data-anadir="ingresos"]').textContent));
  r['3. y «Añade tu gasto» en los dos bloques'] = await p.evaluate(() =>
    ['fijos','variables'].every(k => /Añade tu gasto/.test(
      document.querySelector(`#p-mes [data-anadir="${k}"]`).textContent)));

  // ── 2 · escribir una categoría nueva ───────────────────────
  await p.click('#p-mes [data-anadir="variables"]');
  await p.waitForTimeout(250);
  r['4. se abre el diálogo de añadir'] = await p.evaluate(() => document.getElementById('dlgAnadir').open);
  r['4b. al crear una nueva NO hay botón de borrar'] = await p.evaluate(() => {
    const b = document.getElementById('btnAnBorrar');
    return b.hidden === true && getComputedStyle(b).display === 'none';
  });
  r['4c. el nombre se escribe de izquierda a derecha'] = await p.evaluate(() =>
    getComputedStyle(document.getElementById('anCat')).textAlign === 'left');
  r['5. el título invita, no manda'] = await p.evaluate(() =>
    document.getElementById('anTitulo').textContent === 'Añade tu gasto');
  r['6. sugiere categorías para no escribirlas'] = await p.evaluate(() =>
    document.querySelectorAll('#anSug [data-sugcat]').length >= 5);

  // pulsar una sugerencia rellena el nombre
  await p.evaluate(() => document.querySelector('#anSug [data-sugcat="Comida"]').click());
  r['7. la sugerencia rellena la casilla'] = await p.evaluate(() =>
    document.getElementById('anCat').value === 'Comida');

  await p.fill('#anImp', '200');
  await p.click('#btnAnOk');
  await p.waitForTimeout(300);
  r['8. la categoría escrita aparece de azulejo'] = await p.evaluate(() =>
    !!document.querySelector('#p-mes [data-teja="variables|Comida"]'));
  r['9. con su importe bien grande'] = await p.evaluate(() =>
    /200/.test(document.querySelector('[data-teja="variables|Comida"] .teja-v').textContent));
  r['10. y queda guardada para volver a sugerirla'] = await p.evaluate(() =>
    S.etiquetas.variables.includes('Comida'));

  // ── 3 · cambiar el importe sin perder la categoría ─────────
  await p.click('[data-teja="variables|Comida"]');
  await p.waitForTimeout(250);
  r['11. al pulsar el azulejo se abre para editar'] = await p.evaluate(() =>
    document.getElementById('dlgAnadir').open &&
    document.getElementById('anTitulo').textContent === 'Comida' &&
    document.getElementById('anCat').disabled === true);
  r['12. viene con el importe puesto'] = await p.evaluate(() =>
    document.getElementById('anImp').value.replace(',','.') === '200');
  await p.fill('#anImp', '235,50');
  await p.click('#btnAnOk');
  await p.waitForTimeout(300);
  r['13. cambia el importe y la categoría sigue'] = await p.evaluate(() =>
    totalPartida(S.mes,'variables','Comida') === 235.5 &&
    S.etiquetas.variables.includes('Comida'));

  // ── 4 · la chincheta: que vuelva sola el mes que viene ─────
  await p.click('[data-anadir="fijos"]');
  await p.waitForTimeout(200);
  await p.evaluate(() => { document.getElementById('anCat').value = 'Alquiler'; });
  await p.fill('#anImp', '750');
  await p.check('#anFija');
  await p.click('#btnAnOk');
  await p.waitForTimeout(300);
  r['14. se ancla desde el mismo diálogo'] = await p.evaluate(() => !!fijaDe('fijos','Alquiler'));
  r['15. el azulejo enseña la chincheta'] = await p.evaluate(() =>
    !!document.querySelector('[data-teja="fijos|Alquiler"] .teja-pin'));

  const mesQueViene = await p.evaluate(() => {
    const [a,m] = S.mes.split('-').map(Number);
    const d = new Date(a, m, 1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  });
  await p.evaluate(m => { irAlMes(m); }, mesQueViene);
  await p.waitForTimeout(350);
  r['16. el mes que viene vuelve sola'] = await p.evaluate(() =>
    !!document.querySelector('[data-teja="fijos|Alquiler"]') && totalPartida(S.mes,'fijos','Alquiler') === 750);
  r['17. y avisa de que hay que confirmarla'] = await p.evaluate(() => {
    const t = document.querySelector('[data-teja="fijos|Alquiler"]');
    return t.classList.contains('porconfirmar') && /confírmalo/i.test(t.textContent);
  });
  r['18. lo que NO está anclado no se arrastra'] = await p.evaluate(() =>
    !document.querySelector('[data-teja="variables|Comida"]'));

  // volver al mes de trabajo
  await p.evaluate(() => { const [a,m]=S.mes.split('-').map(Number); const d=new Date(a,m-2,1);
    irAlMes(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); });
  await p.waitForTimeout(300);

  // ── 5 · los tiques SUMAN dentro de la categoría ────────────
  await p.evaluate(() => {
    S.apuntes.push({ id: uid(), mes:S.mes, seccion:'variables', item:'Comida',
                     desc:'Mercadona', fecha:fechaParaMes(S.mes), importe:50 });
    render();
  });
  await p.waitForTimeout(250);
  r['19. el tique suma en el azulejo (235,50 + 50)'] = await p.evaluate(() =>
    totalPartida(S.mes,'variables','Comida') === 285.5 &&
    /285,50/.test(document.querySelector('[data-teja="variables|Comida"] .teja-v').textContent));
  r['20. el azulejo avisa de que hay desglose'] = await p.evaluate(() =>
    /desglose/i.test(document.querySelector('[data-teja="variables|Comida"] .teja-s').textContent));

  await p.click('[data-teja="variables|Comida"]');
  await p.waitForTimeout(350);
  r['21. con varios apuntes NO abre el diálogo: abre el desglose'] = await p.evaluate(() =>
    !document.getElementById('dlgAnadir').open && S.partidaAbierta === 'variables|Comida');
  r['22. el desglose lista los dos apuntes'] = await p.evaluate(() =>
    document.body.textContent.includes('Mercadona'));
  r['23. y tiene su gráfico circular'] = await p.evaluate(() =>
    document.querySelectorAll('#p-mes svg.anillo .arco').length === 2);

  await p.evaluate(() => { S.partidaAbierta = null; render(); });
  await p.waitForTimeout(250);

  // ── 6 · borrar lo del mes sin perder la categoría ──────────
  await p.click('[data-teja="fijos|Alquiler"]');
  await p.waitForTimeout(250);
  r['24. una categoría anclada se puede editar'] = await p.evaluate(() =>
    document.getElementById('dlgAnadir').open && document.getElementById('anFija').checked);
  r['25. hay botón de borrar solo al editar'] = await p.evaluate(() => {
    const b = document.getElementById('btnAnBorrar');
    return b.hidden === false && getComputedStyle(b).display !== 'none';
  });
  await p.click('#btnAnBorrar');
  await p.waitForTimeout(250);
  r['26. borrar pregunta antes'] = await p.evaluate(() => document.getElementById('dlgConf').open);
  await p.click('#btnConfSi');
  await p.waitForTimeout(300);
  r['27. se va del mes pero la categoría queda'] = await p.evaluate(() =>
    !document.querySelector('[data-teja="fijos|Alquiler"]') && S.etiquetas.fijos.includes('Alquiler'));

  // ── 7 · lo de siempre sigue en pie ─────────────────────────
  r['28. los totales de cabecera cuadran'] = await p.evaluate(() => {
    const T = resumenMes(S.mes);
    return T.variables === 285.5 && T.fijos === 0;
  });
  r['29. el escáner sigue en cada bloque'] = await p.evaluate(() =>
    document.querySelectorAll('#p-mes [data-act="foto-tique"]').length === 2);
  r['30. sin errores de JS'] = errs.length === 0;

  await p.screenshot({ path:OUT+'/mosaico-oscuro.png', fullPage:false });
  const ctx2 = await b.newContext({ colorScheme:'light', viewport:{width:420,height:900} });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p2.goto('http://localhost:8902/index.html');
  await p2.waitForTimeout(1100);
  await p2.evaluate(() => {
    S.configurado = true; S.apuntes = []; S.fijas = [];
    S.etiquetas = { ingresos:['Nómina','Otros'], fijos:['Otros'], variables:['Otros'], colchon:['Aporte al colchón'] };
    ponerImporte(S.mes,'ingresos','Nómina',1850);
    ponerImporte(S.mes,'fijos','Alquiler',750); anclar('fijos','Alquiler',750);
    ponerImporte(S.mes,'fijos','Luz',61.2);  anclar('fijos','Luz',61.2);
    ponerImporte(S.mes,'variables','Comida',235.5);
    S.apuntes.push({id:uid(),mes:S.mes,seccion:'variables',item:'Comida',desc:'Mercadona',fecha:fechaParaMes(S.mes),importe:50});
    ponerImporte(S.mes,'variables','Gasolina',88);
    S.modulo='economia'; S.tab='mes'; render();
  });
  await p2.waitForTimeout(400);
  await p2.screenshot({ path:OUT+'/mosaico-movil.png', fullPage:true });
  // medidas reales, no impresiones
  const med = await p2.evaluate(() => {
    const t = document.querySelector('[data-teja="variables|Comida"]');
    const b = t.querySelector('.teja-peso'); const rb = b.getBoundingClientRect();
    return { alto: Math.round(t.getBoundingClientRect().height),
             barraAlto: Math.round(rb.height), barraAncho: Math.round(rb.width),
             cifra: getComputedStyle(t.querySelector('.teja-v')).fontSize,
             columnas: getComputedStyle(document.querySelector('#p-mes .mosaico')).gridTemplateColumns.split(' ').length };
  });
  r['31. la barra de peso se ve de verdad'] = med.barraAlto >= 2 && med.barraAncho >= 2;
  r['32. en móvil caben dos columnas'] = med.columnas === 2;

  console.log('\n══ MOSAICO (maqueta B) ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  console.log('medidas:', JSON.stringify(med));
  if (errs.length) console.log('errores:', errs.slice(0,4));
  await b.close();
})();

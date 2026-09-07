const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ colorScheme:'dark', viewport:{width:900,height:1200} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);
  const r = {};

  // Reproducir la cuenta de César: sus categorías de siempre, con dinero dentro
  await p.evaluate(() => {
    S.configurado = true;
    S.etiquetas = {
      ingresos:  ['Nómina','H1','H2','H3','Otros'],
      fijos:     ['Alquiler','Comunidad','Luz','Gas','Teléfono','Gimnasio','Comida Dulce','Comida','Propina Hugo','Otros'],
      variables: ['Gastos personales','Peluquería','Otros'],
      colchon:   ['Aporte al colchón']
    };
    S.apuntes = [];
    ponerImporte(S.mes,'fijos','Comida', 24.70);   // Comida SÍ tiene dinero
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render();
  });
  await p.waitForTimeout(300);

  r['1. hay botón para cambiar categorías'] = await p.evaluate(() =>
    !!document.querySelector('[data-act="rehacer-categorias"]'));

  await p.click('[data-act="rehacer-categorias"]');
  await p.waitForTimeout(350);

  r['2. abre la pantalla de categorías'] = await p.evaluate(() =>
    !!document.querySelector('[data-act="arranque-listo"]'));
  r['3. NO dice «vamos a empezar»'] = await p.evaluate(() => {
    const pane = document.getElementById('p-mes');
    const h = pane.querySelector('.card-hd h3');
    return /Tus categorías/i.test(h.textContent) && !/Vamos a montar/i.test(pane.textContent);
  });
  r['4. enseña SUS categorías propias'] = await p.evaluate(() => {
    const t = document.body.textContent;
    return t.includes('Propina Hugo') && t.includes('Comida Dulce') && t.includes('H1');
  });
  r['5. marca las que tienen apuntes'] = await p.evaluate(() =>
    !!document.querySelector('[data-sug="fijos|Comida"][data-usada]'));

  // quitar una SIN apuntes: debe irse
  const antes = await p.evaluate(() => S.etiquetas.fijos.length);
  await p.evaluate(() => document.querySelector('[data-sug="fijos|Propina Hugo"]').click());
  await p.waitForTimeout(250);
  r['6. quita una sin apuntes'] = await p.evaluate(() =>
    !S.etiquetas.fijos.includes('Propina Hugo'));

  // quitar una CON apuntes: debe negarse
  await p.evaluate(() => document.querySelector('[data-sug="fijos|Comida"]').click());
  await p.waitForTimeout(250);
  r['7. NO deja quitar una con dinero dentro'] = await p.evaluate(() =>
    S.etiquetas.fijos.includes('Comida') && totalPartida(S.mes,'fijos','Comida') === 24.7);

  // añadir una sugerida
  await p.evaluate(() => {
    const c = document.querySelector('[data-sug="fijos|Internet"]');
    if (c) c.click();
  });
  await p.waitForTimeout(250);
  r['8. añade una sugerida'] = await p.evaluate(() => S.etiquetas.fijos.includes('Internet'));

  await p.screenshot({ path:OUT+'/rehacer.png' });

  await p.click('[data-act="arranque-listo"]');
  await p.waitForTimeout(350);
  r['9. al guardar vuelve al listado'] = await p.evaluate(() =>
    document.querySelectorAll('.bloque-gasto').length === 2 &&
    !document.querySelector('[data-act="arranque-listo"]'));
  r['10. los cambios se han quedado'] = await p.evaluate(() =>
    !S.etiquetas.fijos.includes('Propina Hugo') && S.etiquetas.fijos.includes('Internet'));
  r['11. el dinero de Comida sigue ahí'] = await p.evaluate(() =>
    totalPartida(S.mes,'fijos','Comida') === 24.7);
  r['12. sigue configurado (no vuelve al día 1)'] = await p.evaluate(() => S.configurado === true);
  r['13. sin errores de JS'] = errs.length === 0;

  console.log('\n══ REHACER MIS CATEGORÍAS ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

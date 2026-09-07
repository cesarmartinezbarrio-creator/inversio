const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const r = {};

  // ── Con sesión: diálogo de datos, versión, exportar, restaurar ──
  const ctx = await b.newContext({ viewport:{width:1000,height:1300}, acceptDownloads:true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1100);

  await p.evaluate(() => {
    S.configurado = true; S.apuntes = []; S.fijas = [];
    S.etiquetas = { ingresos:['Nómina'], fijos:['Alquiler'], variables:['Comida'], colchon:['Aporte al colchón'] };
    ponerImporte(S.mes,'ingresos','Nómina',1850);
    ponerImporte(S.mes,'variables','Comida',210);
    S.modulo='economia'; S.tab='mes'; render();
  });
  await p.waitForTimeout(200);

  r['1. hay botón de datos en la barra'] = await p.evaluate(() => !!document.getElementById('btnDatos'));
  await p.click('#btnDatos');
  await p.waitForTimeout(250);
  r['2. abre el diálogo de datos'] = await p.evaluate(() => document.getElementById('dlgDatos').open);
  r['3. enseña el sello de versión'] = await p.evaluate(() =>
    /\d{4}\.\d{2}\.\d{2}/.test(document.getElementById('verApp').textContent));

  // exportar: dispara una descarga con nombre y contenido válido
  const [dl] = await Promise.all([
    p.waitForEvent('download'),
    p.click('[data-act="exportar-datos"]')
  ]);
  const nombre = dl.suggestedFilename();
  r['4. exportar descarga un fichero .json con fecha'] = /^cuentas-y-cartera-\d{4}-\d{2}-\d{2}\.json$/.test(nombre);
  const fs = require('fs'); const path = OUT+'/'+nombre;
  await dl.saveAs(path);
  let copia = null; try { copia = JSON.parse(fs.readFileSync(path,'utf8')); } catch(_){}
  r['5. la copia es JSON con tus apuntes'] = !!(copia && Array.isArray(copia.apuntes) && copia.apuntes.length >= 2);

  // restaurar: cambiamos algo, restauramos la copia y debe volver
  await p.evaluate(() => document.getElementById('dlgDatos').close());
  await p.evaluate(() => { S.apuntes = []; render(); });
  await p.click('#btnDatos'); await p.waitForTimeout(150);
  await p.evaluate(txt => { document.getElementById('datosText').value = txt; }, JSON.stringify(copia));
  await p.click('[data-act="restaurar-datos"]');
  await p.waitForTimeout(200);
  r['6. restaurar pide confirmación'] = await p.evaluate(() => document.getElementById('dlgConf').open);
  await p.click('#btnConfSi');
  await p.waitForTimeout(300);
  r['7. tras restaurar vuelven los apuntes'] = await p.evaluate(() => S.apuntes.length >= 2);

  // ── Paginación del detalle con muchos apuntes ──────────────────
  await p.evaluate(() => {
    S.apuntes = [];
    S.etiquetas = { ingresos:['Nómina'], fijos:['Alquiler'], variables:['Comida'], colchon:['Aporte al colchón'] };
    for (let i=0;i<600;i++) S.apuntes.push({id:uid(),mes:S.mes,seccion:'variables',item:'Comida',desc:'t'+i,fecha:S.mes+'-05',importe:(i%40)+1});
    S.modulo='economia'; S.tab='mes'; S.partidaAbierta = 'variables|Comida'; render();
  });
  await p.waitForTimeout(400);
  r['8. el detalle no pinta 600 filas de golpe'] = await p.evaluate(() =>
    document.querySelectorAll('.apunte').length <= 150);
  const dbg = await p.evaluate(() => ({
    filas: document.querySelectorAll('#p-mes .apunte').length,
    conf: S.configurado, pant: (typeof pantallaCategorias!=='undefined'?pantallaCategorias:'?'),
    abierta: S.partidaAbierta, mod: S.modulo, tab: S.tab, nap: S.apuntes.length,
    aviso: (document.querySelector('#p-mes').textContent.match(/Se muestran[^.]*\./)||['(no)'])[0]
  }));
  console.log('   dbg9:', JSON.stringify(dbg));
  const txt9 = dbg.aviso;
  r['9. avisa de cuántos apuntes hay en total'] = /recientes de\s*600/.test(txt9);
  r['10. el anillo agrupa en pocas porciones'] = await p.evaluate(() =>
    document.querySelectorAll('#p-mes svg.anillo .arco').length <= 12);
  r['11. el total suma los 600'] = await p.evaluate(() =>
    Math.round(totalPartida(S.mes,'variables','Comida')) === Math.round([...Array(600)].reduce((s,_,i)=>s+((i%40)+1),0)));

  r['12. sin errores de JS (sesión)'] = errs.length === 0;

  // ── Modo demo: sin sesión, con datos, sin guardar ──────────────
  const ctx2 = await b.newContext({ viewport:{width:1000,height:1300} });
  const p2 = await ctx2.newPage();
  const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  // NO ponemos sesión: probamos que el demo entra igual
  let subio = false;
  await p2.addInitScript(() => { window.fetch = async (u,o) => {
    if ((o&&o.method==='POST') && String(u).includes('perfiles_estado')) window.__SUBIO__ = true;
    return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  }; });
  await p2.goto('http://localhost:8902/index.html?demo=1');
  await p2.waitForTimeout(1200);
  r['13. el demo arranca SIN sesión'] = await p2.evaluate(() => !location.pathname.endsWith('acceso.html'));
  r['14. el demo trae datos de ejemplo'] = await p2.evaluate(() =>
    S && Array.isArray(S.apuntes) && S.apuntes.length > 0 && S.activos.length > 0);
  r['15. el demo NO escribe en localStorage'] = await p2.evaluate(() => !localStorage.getItem('cyc.estado.v1'));
  r['16. el demo NO sube nada a la nube'] = await p2.evaluate(() => !window.__SUBIO__);
  r['17. sin errores de JS (demo)'] = errs2.length === 0;

  await p2.evaluate(() => { S.modulo='economia'; S.tab='mes'; render(); });
  await p2.waitForTimeout(300);
  await p2.screenshot({ path:OUT+'/demo.png', fullPage:false });
  await p.click('#btnDatos'); await p.waitForTimeout(200);
  await p.screenshot({ path:OUT+'/datos.png' });

  console.log('\n══ EXTRAS (versión · copia · demo · paginación) ══');
  let mal=0; for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  if (errs.length) console.log('errores sesión:', errs.slice(0,4));
  if (errs2.length) console.log('errores demo:', errs2.slice(0,4));
  await b.close();
})();

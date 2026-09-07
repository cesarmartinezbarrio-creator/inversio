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
  await p.evaluate(() => { S.configurado = true; S.modulo='economia'; S.tab='mes'; S.partidaAbierta=null; render(); });
  await p.waitForTimeout(300);

  const r = {};
  r['1. arranca sin errores'] = errs.length === 0;
  r['2. no queda nada de la cámara'] = await p.evaluate(() =>
    !document.getElementById('tiqueCamara') && !document.getElementById('btnTiqueCam') &&
    !document.getElementById('tiqueVideo') && !document.getElementById('tiqueOrigen') &&
    typeof window.abreCamara === 'undefined');
  r['3. acepta los formatos habituales'] = await p.evaluate(() => {
    const a = document.getElementById('ficheroTique').accept;
    return ['jpeg','png','webp','heic','gif','bmp','tiff'].every(f => a.includes(f));
  });
  r['4. el botón abre el selector directamente'] = await p.evaluate(() => {
    let abrio = false;
    const i = document.getElementById('ficheroTique');
    i.click = () => { abrio = true; };
    document.querySelector('[data-act="foto-tique"][data-seccion="variables"]').click();
    return abrio && !document.getElementById('dlgTique').open;   // sin paso intermedio
  });
  r['5. sigue sabiendo el tipo de gasto'] = await p.evaluate(() => seccionTique === 'variables');
  r['6. los dos escáneres siguen ahí'] = await p.evaluate(() =>
    document.querySelectorAll('[data-act="foto-tique"]').length === 2);

  // El recorrido completo, con OCR de verdad
  const t0 = Date.now();
  const out = await p.evaluate(async () => {
    const blob = await (await fetch('/tique_foto.jpg')).blob();
    seccionTique = 'fijos';
    await leerTique(new File([blob],'t.jpg',{type:'image/jpeg'}));
    return { fallo: document.getElementById('tiqueFallo').hidden ? null : document.getElementById('tiqueFalloTxt').textContent,
             importe: document.getElementById('tqImporte').value,
             seccion: document.getElementById('tqSeccion').value };
  });
  r['7. lee la imagen cargada'] = out.fallo === null && out.importe === '38,17';
  r['8. respeta el bloque desde el que se pulsó'] = out.seccion === 'fijos';
  r['9. sin errores al final'] = errs.length === 0;

  console.log('\n══ SOLO CARGAR IMAGEN ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length} · OCR en ${((Date.now()-t0)/1000).toFixed(1)} s`);
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

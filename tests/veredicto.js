const { chromium, LAUNCH, OUT } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.fetch = async () => new Response(JSON.stringify({id:'u1'}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1200);
  await p.evaluate(() => { S.configurado = true; });

  const r = {};

  // Una empresa con cuentas: se le pueden fabricar los tres veredictos
  const monta = async (calidad) => p.evaluate(q => {
    S.activos = [];
    const a = activoVacio('Empresa ' + q);
    a.categoria = 'Acciones'; a.estado = 'estudio'; a.precio = 100;
    a.anios = [2021,2022,2023,2024,2025];
    const n = a.anios.length;
    // buena: ventas creciendo, margen al alza, sin deuda, caja positiva
    // mala: ventas cayendo, deuda alta, caja negativa
    const buena = q === 'buena';
    const media = q === 'media';
    const ventas = a.anios.map((_,i) => buena ? 100*Math.pow(1.15,i) : media ? 100*Math.pow(1.06,i) : 100*Math.pow(0.95,i));
    a.d.ventas = ventas;
    a.d.ebit   = ventas.map((v,i) => v * (buena ? 0.20 + i*0.005 : media ? 0.14 : 0.05 - i*0.004));
    a.d.beneficio = a.d.ebit.map(v => v*0.75);
    a.d.acciones = a.anios.map(() => buena ? 100 - 0 : 100);
    a.d.deuda  = a.anios.map(() => buena ? 20 : media ? 120 : 400);
    a.d.caja   = a.anios.map(() => buena ? 80 : media ? 40 : 5);
    a.d.patrimonio = a.anios.map(() => 200);
    a.d.flujoOperativo = a.d.ebit.map(v => buena ? v*1.1 : media ? v*0.9 : v*0.4);
    a.d.capexTotal = a.anios.map(() => buena ? 10 : 30);
    S.activos.push(a);
    S.fichaAbierta = a.id; S.modulo='mercado'; S.tab='ficha'; render();
    const R = veredictoDe(a);
    return R ? { estado: R.vEstado, pct: (puntuaVeredicto(R)||{}).pct } : null;
  }, calidad);

  const res = {};
  for (const q of ['buena','media','mala']) res[q] = await monta(q);
  await p.waitForTimeout(300);

  r['1. la tarjeta sale en la ficha'] = await p.evaluate(() => {
    const v = document.querySelector('.veredicto');
    return !!v && !!v.querySelector('.ver-pct') && !!v.querySelector('.ver-t');
  });
  r['2. es lo primero de la página'] = await p.evaluate(() =>
    document.getElementById('p-ficha').firstElementChild.classList.contains('veredicto'));
  r['3. hay porcentaje visible'] = await p.evaluate(() =>
    /^\d{1,3}$/.test(document.querySelector('.ver-pct').textContent.replace('%','').trim()));
  r['4. el texto es uno de los tres'] = await p.evaluate(() =>
    ['Invertir','Observar','No invertir'].includes(document.querySelector('.ver-t').textContent.trim()));
  r['5. el color acompaña al texto'] = await p.evaluate(() => {
    const v = document.querySelector('.veredicto');
    const t = v.querySelector('.ver-t').textContent.trim();
    return (t==='Invertir'&&v.classList.contains('ok')) || (t==='Observar'&&v.classList.contains('mid')) || (t==='No invertir'&&v.classList.contains('bad'));
  });
  r['6. distingue empresa buena de mala'] =
    res.buena && res.mala && res.buena.pct > res.mala.pct;
  r['7. la nota nunca se sale de 0-100'] =
    Object.values(res).every(x => !x || (x.pct >= 0 && x.pct <= 100));

  // ─── El porqué ───────────────────────────────────────────────
  await p.click('.veredicto');
  await p.waitForTimeout(350);
  const pq = await p.evaluate(() => {
    const d = document.getElementById('dlgPorQue');
    return {
      abierto: d.open,
      pct: !!d.querySelector('.pq-pct'),
      barra: d.querySelectorAll('.pq-barra i').length,
      grupos: [...d.querySelectorAll('.pq-h')].map(h => h.textContent.trim().split(' ')[0]),
      filas: d.querySelectorAll('.pq-fila').length,
      decide: (d.querySelector('.callout')||{}).textContent || '',
      honesto: d.textContent.includes('No es la probabilidad de ganar dinero')
    };
  });
  r['8. al pulsar se abre el porqué'] = pq.abierto;
  r['9. repite la nota grande'] = pq.pct;
  r['10. una marca por comprobación'] = pq.barra >= 8;
  r['11. las agrupa (a favor / en contra…)'] = pq.grupos.length >= 2;
  r['12. lista las comprobaciones'] = pq.filas >= 8;
  r['13. dice qué ha decidido el veredicto'] = pq.decide.length > 40;
  r['14. avisa de que NO predice el precio'] = pq.honesto;

  // ─── El mensaje de cuenta sin activar ────────────────────────
  r['15. el mensaje de cuenta sin activar es claro'] = await p.evaluate(() => {
    const t = textoErrorMcp({ code:'sin_invitacion' }, 'Twelve Data');
    return !/no he podido leer/i.test(t) && /activada|canjear/i.test(t);
  });
  r['16. sin errores de JS'] = errs.length === 0;

  console.log('\n══ VEREDICTO EN LA FICHA ══');
  let mal = 0;
  for (const [k,v] of Object.entries(r)){ if(!v) mal++; console.log((v?' OK  ':' MAL ')+k); }
  console.log(`\n${Object.keys(r).length-mal}/${Object.keys(r).length}`);
  console.log('notas:', JSON.stringify(res));
  if (errs.length) console.log('errores:', errs.slice(0,3));
  await b.close();
})();

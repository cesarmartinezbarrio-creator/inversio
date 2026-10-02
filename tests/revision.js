// Comprueba las correcciones de la revisión del 2 de octubre de 2026:
// cálculos, importación, copia local por usuario y conflictos al guardar.
const { chromium, LAUNCH } = require('./_pw');

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:1000,height:900} })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // Sesión falsa y una «nube» simulada que guarda la revisión como Supabase
  await p.addInitScript(() => {
    localStorage.setItem('cyc.sesion', JSON.stringify({access_token:'T',refresh_token:'R',caduca:Date.now()+36e5,correo:'a@b.com',uid:'u1'}));
    window.__nube = { json: { apuntes: [], rev: 5 } };
    window.fetch = async (url, op = {}) => {
      const u = String(url), m = (op.method || 'GET').toUpperCase();
      const resp = (obj, st = 200) => new Response(JSON.stringify(obj), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.includes('/rest/v1/perfiles_estado')){
        if (m === 'GET') return resp(window.__nube ? [{ json: window.__nube.json }] : []);
        if (m === 'PATCH'){
          const rev = decodeURIComponent((u.match(/json->>rev=eq\.([^&]+)/) || [])[1] || '');
          if (!window.__nube || String(window.__nube.json.rev) !== rev) return resp([]);
          window.__nube.json = JSON.parse(op.body).json; return resp([{ user_id: 'u1' }]);
        }
        if (m === 'POST'){
          if (window.__nube) return resp([]);
          window.__nube = { json: JSON.parse(op.body)[0].json }; return resp([{ user_id: 'u1' }], 201);
        }
      }
      return resp({ id: 'u1' });
    };
  });
  await p.goto('http://localhost:8902/index.html');
  await p.waitForTimeout(1200);
  const r = {};

  // ── Las tres cifras de referencia del documento ──
  r['1. 10.000 € de ganancia pagan 1.980 €'] = await p.evaluate(() => Math.round(impuestoAhorro(10000)) === 1980);
  r['2. 250.000 € de ganancia pagan 58.380 €'] = await p.evaluate(() => Math.round(impuestoAhorro(250000)) === 58380);
  r['3. 300 €/mes al 6% durante 33 años ≈ 359.970,98 €'] = await p.evaluate(() =>
    Math.abs(tablaCompuesto(0, 300, 0.06, 33, 0, 0.19)[32].total - 359970.98) < 0.5);

  // ── Cálculos corregidos ──
  r['4. interés compuesto con −6%: ≈ 3.499,89 €, no 3.600'] = await p.evaluate(() =>
    Math.abs(tablaCompuesto(0, 300, -0.06, 1, 0, 0.19)[0].total - 3499.89) < 0.5);
  r['5. interés compuesto con 0%: lo aportado'] = await p.evaluate(() =>
    tablaCompuesto(0, 300, 0, 1, 0, 0.19)[0].total === 3600);
  r['6. crecimiento con años vacíos cuenta los años reales'] = await p.evaluate(() =>
    Math.abs(cagrSerie([100, null, null, null, 146.41], [2019, 2020, 2021, 2022, 2023]) - 0.10) < 1e-6);
  r['7. una compra sin unidades no crea una pérdida falsa'] = await p.evaluate(() => {
    S.activos = [Object.assign(activoVacio('X'), { id: 'a1', estado: 'cartera', precio: 10 })];
    S.aportaciones = [{ id: 'p1', mes: S.mes, activoId: 'a1', importe: 100, unidades: 10 },
                      { id: 'p2', mes: S.mes, activoId: 'a1', importe: 100, unidades: null }];
    const q = posicion(S.activos[0]);
    return q.valor === 200 && q.pl === 0 && q.parcial === true && q.estimado === true;
  });
  r['8. la anualizada tiene en cuenta cuándo entró cada euro'] = await p.evaluate(() => {
    // 100 € hace un año y 100 € hoy, valen 210: la TIR ronda el 10%, no el 5%
    const hoy = new Date(), mes = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const t = tirMensual([{ mes: mes(new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1)), importe: 100 },
                          { mes: mes(hoy), importe: 100 }], 210);
    return t > 0.08 && t < 0.12;
  });
  r['9. el prudente puede ser negativo si la empresa encoge'] = await p.evaluate(() => {
    const e = estimaConIndicadores({ precio: 100, multCons: 14, multReal: 18, kpi: { bpa: 5, per: 20, perFwd: 25 } });
    return !!e && e.extra.gCons < 0;
  });
  r['10. una crítica sin dato no da veredicto favorable'] = await p.evaluate(() => {
    const e = { anios: [2020, 2021, 2022], d: { ventas: [100, 120, 150], ebit: [20, 25, 32], acciones: [10, 10, 9.8] }, multCons: 14, multReal: 18 };
    const R = semaforo(e, analizar(e));
    return R.vEstado !== 'ok' && R.critSinDato.length > 0;
  });

  // ── Importación ──
  r['11. un identificador manipulado se sustituye al cargar'] = await p.evaluate(() => {
    const o = saneaEstado({ apuntes: [{ id: 'x" onmouseover="alert(1)', mes: '2026-10', seccion: 'fijos', item: 'Luz', importe: 1 }],
      activos: [{ id: 'a" autofocus onfocus="x', nombre: 'Y', estado: 'cartera"><b', moneda: '<i>' }],
      aportaciones: [{ id: 'ok_1', mes: '2026-10', activoId: '"><svg', importe: 5 }] });
    return /^[A-Za-z0-9_-]+$/.test(o.apuntes[0].id) && /^[A-Za-z0-9_-]+$/.test(o.activos[0].id)
      && o.activos[0].estado === 'estudio' && o.activos[0].moneda === '€'
      && o.aportaciones[0].id === 'ok_1' && o.aportaciones[0].activoId === null;
  });

  // ── Copia local ligada a la cuenta ──
  r['12. no se carga la copia local de otra cuenta'] = await p.evaluate(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ apuntes: [], rev: 1, _uid: 'otra' }));
    const ajena = cargarLocal() === null;
    localStorage.setItem(LS_KEY, JSON.stringify({ apuntes: [], rev: 1, _uid: 'u1' }));
    return ajena && cargarLocal() !== null;
  });

  // ── Guardado con revisión ──
  r['13. guardar sube la revisión de la nube'] = await p.evaluate(async () => {
    S.configurado = true; await guardarYa(true);
    return estadoSync === 'ok' && window.__nube.json.rev > 5;
  });
  r['14. si otro dispositivo guardó después, NO se pisa'] = await p.evaluate(async () => {
    window.__nube.json = { apuntes: [{ id: 'z', mes: '2026-10', seccion: 'fijos', item: 'Del móvil', importe: 9 }], rev: 999 };
    S.apuntes.push({ id: 'w', mes: S.mes, seccion: 'fijos', item: 'Del PC', importe: 1 });
    await guardarYa(true);
    return window.__nube.json.rev === 999 && window.__nube.json.apuntes[0].item === 'Del móvil'
      && enConflicto && estadoSync === 'error';
  });
  r['15. y lo de este navegador queda guardado aparte'] = await p.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cyc.estado.conflicto') || 'null');
    return !!c && c.apuntes.some(a => a.item === 'Del PC') && !localStorage.getItem(LS_KEY);
  });

  r['16. sin errores de JS'] = errs.length === 0;

  let ok = 0; const total = Object.keys(r).length;
  console.log('\n══ REVISIÓN DEL 2 DE OCTUBRE ══');
  for (const [k, v] of Object.entries(r)){ console.log(` ${v ? 'OK ' : 'MAL'} ${k}`); if (v) ok++; }
  if (errs.length) console.log(errs);
  console.log(`\n${ok}/${total}`);
  await b.close();
  process.exit(ok === total ? 0 : 1);
})();

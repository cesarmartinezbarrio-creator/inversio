// Batería: EL PROXY DE MERCADO (api/mcp-proxy.js) y su CORS
//
// No abre navegador: prueba el backend directamente, con `fetch` sustituido,
// igual que `puerta.js`. Vigila los arreglos de la auditoría del 01/10/2026:
//   - a Alpha Vantage solo llegan los parámetros previstos (no `function`
//     ni `apikey` que mande el navegador)
//   - `outputsize` de Twelve Data es un número entre 1 y 30
//   - si el contador de cuota no responde, NO se sale a internet
//   - nuestras claves nunca vuelven al navegador en un mensaje de error
//   - sin ALLOWED_ORIGIN, el CORS queda cerrado (antes era "*")
// Los casos 1 y 7 son controles positivos: lo legítimo sigue funcionando.

const path = require('path');
const API = path.resolve(__dirname, '..', 'api');

process.env.SUPABASE_URL = 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'service-key-de-prueba';
process.env.ALPHA_VANTAGE_KEY = 'CLAVE-ALPHA-SECRETA';
process.env.TWELVE_DATA_KEY = 'CLAVE-TWELVE-SECRETA';
process.env.ALLOWED_ORIGIN = 'https://ahorrainvierte.es';

const proxy = require(path.join(API, 'mcp-proxy.js'));
const { aplicarCORS } = require(path.join(API, '_common.js'));

// Supabase y proveedores simulados. Se anota cada URL que sale a internet.
let salidas = [];
let contadorOk = true;
let respuestaProveedor = null;
global.fetch = async (url, opciones = {}) => {
  const u = String(url);
  const json = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b });
  if (u.includes('/auth/v1/user')) return json({ id: 'u-1', email: 'a@b.es' });
  if (u.includes('/rest/v1/miembros')) return json([{ user_id: 'u-1' }]);
  if (u.includes('/rest/v1/precios_cache')) return opciones.method === 'POST' ? json({}) : json([]);
  if (u.includes('/rpc/consume_peticion'))
    return contadorOk ? json([{ permitido: true, usadas: 1, limite_dia: 300 }]) : json({}, 500);
  salidas.push(u);
  return json(respuestaProveedor || { 'Global Quote': { '05. price': '10' }, data: [], price: '10' });
};

function resFalso() {
  const o = { code: null, cuerpo: null, cab: {},
    status(c) { o.code = c; return o; },
    json(b) { o.cuerpo = b; return o; },
    end() { return o; },
    setHeader(k, v) { o.cab[k.toLowerCase()] = v; } };
  return o;
}
async function llama(cuerpo) {
  const req = { method: 'POST', headers: { authorization: 'Bearer buena', origin: 'https://ahorrainvierte.es' }, body: cuerpo };
  const res = resFalso();
  await proxy(req, res);
  return res;
}

(async () => {
  const r = {};
  let z;

  salidas = [];
  z = await llama({ servidor: 'Alpha Vantage MCP Server', herramienta: 'GLOBAL_QUOTE', entrada: { symbol: 'AAPL', datatype: 'json' } });
  r['1. una consulta normal a Alpha Vantage funciona'] = z.code === 200 && salidas.length === 1 && salidas[0].includes('symbol=AAPL');

  salidas = [];
  z = await llama({ servidor: 'Alpha Vantage MCP Server', herramienta: 'GLOBAL_QUOTE',
    entrada: { symbol: 'IBM', function: 'TIME_SERIES_INTRADAY', apikey: 'OTRA', interval: '1min' } });
  const u2 = new URL(salidas[0] || 'http://x');
  r['2. el navegador NO puede cambiar la función de Alpha Vantage'] = u2.searchParams.get('function') === 'GLOBAL_QUOTE';
  r['3. ni la clave, ni colar parámetros que no tocan'] =
    u2.searchParams.get('apikey') === 'CLAVE-ALPHA-SECRETA' && !u2.searchParams.has('interval');

  salidas = [];
  await llama({ servidor: 'Twelve Data', herramienta: 'search_symbol', entrada: { symbol: 'INDITEX', outputsize: '20&format=CSV' } });
  const u4 = new URL(salidas[0] || 'http://x');
  r['4. outputsize no deja colar parámetros y se queda en 1–30'] =
    u4.searchParams.get('outputsize') === '20' && !u4.searchParams.has('format');
  salidas = [];
  await llama({ servidor: 'Twelve Data', herramienta: 'search_symbol', entrada: { symbol: 'X', outputsize: 99999 } });
  r['5. outputsize gigante se recorta a 30'] = new URL(salidas[0] || 'http://x').searchParams.get('outputsize') === '30';

  salidas = []; contadorOk = false;
  z = await llama({ servidor: 'Twelve Data', herramienta: 'get_price', entrada: { symbol: 'MSFT' } });
  r['6. si el contador no responde, NO se sale a internet'] = z.code === 503 && salidas.length === 0 && z.cuerpo?.code === 'server_unavailable';
  contadorOk = true;

  salidas = [];
  respuestaProveedor = { code: 401, message: '**apikey** CLAVE-TWELVE-SECRETA is invalid' };
  z = await llama({ servidor: 'Twelve Data', herramienta: 'get_price', entrada: { symbol: 'MSFT' } });
  respuestaProveedor = null;
  r['7. un error del proveedor sigue llegando como error'] = z.code === 502 && z.cuerpo?.code === 'tool_error';
  r['8. nuestra clave NUNCA vuelve al navegador en el mensaje'] = !JSON.stringify(z.cuerpo).includes('CLAVE-TWELVE-SECRETA');

  // ── CORS ─────────────────────────────────────────────────────
  const cors = (origen) => { const res = resFalso(); aplicarCORS({ headers: { origin: origen } }, res); return res.cab['access-control-allow-origin']; };
  r['9. CORS: el dominio propio sí'] = cors('https://ahorrainvierte.es') === 'https://ahorrainvierte.es';
  r['10. CORS: un dominio ajeno no recibe su propio origen'] = cors('https://malo.example') !== 'https://malo.example';
  delete process.env.ALLOWED_ORIGIN;
  r['11. CORS: sin ALLOWED_ORIGIN queda CERRADO (no "*")'] = cors('https://malo.example') === undefined;

  console.log('\n══ EL PROXY DE MERCADO ══');
  let mal = 0;
  for (const [k, v] of Object.entries(r)) { if (!v) mal++; console.log((v ? ' OK  ' : ' MAL ') + k); }
  const total = Object.keys(r).length;
  console.log(`\n${total - mal}/${total}`);
  process.exit(mal ? 1 : 0);
})();

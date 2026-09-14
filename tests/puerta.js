// Batería: EL PORTERO DE LA API (api/_common.js → identifica)
//
// No abre navegador: prueba el backend directamente, con `fetch` sustituido.
// Existe por un motivo concreto: hasta el 14/09/2026 había una «puerta de
// servicio» (APP_TOKEN) que saltaba la comprobación de membresía y, de paso,
// el contador de cuota. Se retiró. Esta batería está aquí para que no vuelva
// a colarse en un descuido.
//
// El caso 7 es tan importante como los demás: comprueba que al cerrar la
// puerta no se ha roto la entrada legítima.

const path = require('path');
const { identifica } = require(path.resolve(__dirname, '..', 'api', '_common.js'));
const fuente = require('fs').readFileSync(
  path.resolve(__dirname, '..', 'api', '_common.js'), 'utf8');

const USUARIO = { id: 'u-1234', email: 'alguien@ejemplo.com' };

// Supabase simulado. `miembro` decide si la cuenta tiene invitación canjeada.
function montaFetch({ tokenValido, miembro }) {
  global.fetch = async (url, opciones = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      const tok = (opciones.headers?.Authorization || '').replace('Bearer ', '');
      return tok === tokenValido
        ? { ok: true,  status: 200, json: async () => USUARIO }
        : { ok: false, status: 401, json: async () => ({}) };
    }
    if (u.includes('/rest/v1/miembros')) {
      return { ok: true, status: 200,
               json: async () => (miembro ? [{ user_id: USUARIO.id }] : []) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

function resFalso() {
  const o = { code: null, cuerpo: null,
    status(c) { o.code = c; return o; },
    json(b)   { o.cuerpo = b; return o; } };
  return o;
}

async function llama(token) {
  const req = { headers: token ? { authorization: 'Bearer ' + token } : {} };
  const res = resFalso();
  const quien = await identifica(req, res);
  return { quien, code: res.code, cuerpo: res.cuerpo };
}

(async () => {
  process.env.SUPABASE_URL = 'https://ejemplo.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'service-key-de-prueba';

  const r = {};
  let z;

  // ── Escenario hostil: alguien resucita APP_TOKEN en Vercel ──────
  process.env.APP_TOKEN = 'token-quemado-de-los-chats';
  montaFetch({ tokenValido: 'sesion-buena', miembro: true });

  z = await llama('token-quemado-de-los-chats');
  r['1. el APP_TOKEN quemado NO entra'] = z.quien === null && z.code === 401;

  z = await llama('cualquier-cosa');
  r['2. un token inventado no entra'] = z.quien === null && z.code === 401;

  z = await llama(null);
  r['3. sin cabecera Authorization no entra'] = z.quien === null && z.code === 401;

  // ── El código ya no contiene la puerta ──────────────────────────
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  r['4. APP_TOKEN no se lee en ningún sitio'] = !/process\.env\.APP_TOKEN/.test(sinComentarios);
  r['5. no queda rama tipo:"legado"'] = !/legado/.test(sinComentarios);
  r['6. compruebaToken ya no se exporta'] =
    require(path.resolve(__dirname, '..', 'api', '_common.js')).compruebaToken === undefined;

  // ── Control positivo: la entrada legítima sigue funcionando ─────
  delete process.env.APP_TOKEN;

  z = await llama('sesion-buena');
  r['7. sesión válida y con invitación SÍ entra'] =
    z.quien && z.quien.tipo === 'usuario' && z.quien.id === USUARIO.id;

  montaFetch({ tokenValido: 'sesion-buena', miembro: false });
  z = await llama('sesion-buena');
  r['8. sesión válida sin invitación da 403'] =
    z.quien === null && z.code === 403 && z.cuerpo?.code === 'sin_invitacion';

  console.log('\n══ EL PORTERO DE LA API (sin puerta de servicio) ══');
  let mal = 0;
  for (const [k, v] of Object.entries(r)) { if (!v) mal++; console.log((v ? ' OK  ' : ' MAL ') + k); }
  const total = Object.keys(r).length;
  console.log(`\n${total - mal}/${total}`);
  process.exit(mal ? 1 : 0);
})();

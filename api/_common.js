// Utilidades compartidas por las funciones de /api.
// CommonJS a propósito: así Vercel no necesita "type":"module" en package.json.

// ALLOWED_ORIGIN admite varios dominios separados por comas, por ejemplo:
//   https://ahorrainvierte.es,https://www.ahorrainvierte.es,https://algo.hostingersite.com
// Se devuelve el que coincida con el Origin de la petición; si no coincide
// ninguno, se devuelve el primero de la lista (y el navegador lo bloqueará,
// que es justo lo que queremos con un origen desconocido).
function aplicarCORS(req, res) {
  const lista = (process.env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origen = req.headers.origin || "";
  const permitido = lista.includes("*") ? "*"
    : lista.includes(origen) ? origen
    : (lista[0] || "*");
  res.setHeader("Access-Control-Allow-Origin", permitido);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "X-Cache, X-Uso-Hoy, X-Limite-Dia");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function tokenDeCabecera(req) {
  const cabecera = req.headers["authorization"] || "";
  return cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
}

// Devuelve true si la petición está autorizada. Si no lo está, ya ha
// escrito la respuesta 401 y el caller debe simplemente "return".
// (Modo de un solo usuario. Se queda mientras dure la migración a cuentas;
//  desaparece cuando el frontend viejo ya no exista.)
function compruebaToken(req, res) {
  const token = tokenDeCabecera(req);
  const esperado = process.env.APP_TOKEN || "";
  if (!esperado) {
    res.status(500).json({ code: "server_unavailable", message: "APP_TOKEN no está configurado en Vercel." });
    return false;
  }
  if (token !== esperado) {
    res.status(401).json({ code: "needs_reauth", message: "Token incorrecto o caducado." });
    return false;
  }
  return true;
}

async function leerCuerpoJSON(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel ya lo parsea si Content-Type: application/json
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

/* ═══════════════════════════════════════════════════════════════
   Supabase: acceso con la clave de servicio
   ═══════════════════════════════════════════════════════════════
   Esta clave se salta Row Level Security por diseño, así que solo vive
   aquí, en el servidor, y nunca viaja al navegador. Todo lo que se hace
   con ella está en este fichero, para poder revisarlo de un vistazo. */

const SB_URL = () => (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY || "";

function sbConfigurado() { return !!(SB_URL() && SB_KEY()); }

async function sbRest(ruta, opciones = {}) {
  const r = await fetch(`${SB_URL()}${ruta}`, {
    ...opciones,
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
  return r;
}

/* ── Quién es quien llama ──────────────────────────────────────
   Se le pregunta a Supabase, no se descifra el JWT aquí. Es una llamada
   de red más (unos 50 ms) a cambio de algo que la criptografía sola no
   da: si la sesión se cerró hace un minuto, o al usuario le han quitado
   la cuenta, Supabase lo sabe y un token "matemáticamente válido" deja
   de servir en el acto. */
async function usuarioDelToken(token) {
  if (!token || !sbConfigurado()) return null;
  const r = await fetch(`${SB_URL()}/auth/v1/user`, {
    headers: { apikey: SB_KEY(), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || !j.id) return null;
  return { id: j.id, correo: j.email || "", aal: (j.aal || j.aal_level || "") };
}

// ¿Tiene invitación canjeada? Sin fila en `miembros` no se pasa de aquí,
// aunque la cuenta exista y la contraseña sea correcta.
async function esMiembro(userId) {
  const r = await sbRest(`/rest/v1/miembros?user_id=eq.${encodeURIComponent(userId)}&select=user_id`);
  if (!r.ok) return false;
  const filas = await r.json().catch(() => []);
  return Array.isArray(filas) && filas.length > 0;
}

/* ── El portero ────────────────────────────────────────────────
   Devuelve:
     { tipo: "usuario", id, correo }  sesión válida y con invitación
     { tipo: "legado" }               el token único de la app de siempre
     null                             ya ha respondido con el error
   El modo legado se mantiene mientras el frontend antiguo siga vivo. En
   cuanto todo el mundo entre con su cuenta, se borra APP_TOKEN de Vercel
   y este camino se cierra solo. */
async function identifica(req, res) {
  const token = tokenDeCabecera(req);
  if (!token) {
    res.status(401).json({ code: "needs_reauth", message: "Hay que iniciar sesión." });
    return null;
  }

  const legado = process.env.APP_TOKEN || "";
  if (legado && token === legado) return { tipo: "legado" };

  const usuario = await usuarioDelToken(token);
  if (!usuario) {
    res.status(401).json({ code: "needs_reauth", message: "La sesión ha caducado. Vuelve a entrar." });
    return null;
  }
  if (!(await esMiembro(usuario.id))) {
    res.status(403).json({ code: "sin_invitacion", message: "Esta cuenta todavía no ha canjeado un código de invitación." });
    return null;
  }
  return { tipo: "usuario", ...usuario };
}

/* ── Caché compartida de datos de mercado ──────────────────────
   Nadie más que este backend la lee ni la escribe: la tabla tiene RLS
   activado y ninguna política. */

async function cacheLee(clave) {
  if (!sbConfigurado()) return null;
  const r = await sbRest(
    `/rest/v1/precios_cache?clave=eq.${encodeURIComponent(clave)}&vence=gt.${encodeURIComponent(new Date().toISOString())}&select=payload`
  );
  if (!r.ok) return null;
  const filas = await r.json().catch(() => []);
  return Array.isArray(filas) && filas.length ? filas[0].payload : null;
}

async function cacheGuarda(clave, payload, segundos) {
  if (!sbConfigurado()) return;
  const fila = {
    clave,
    payload,
    vence: new Date(Date.now() + segundos * 1000).toISOString(),
    actualizado: new Date().toISOString(),
  };
  // merge-duplicates = "si ya existe esa clave, actualízala" (upsert).
  await sbRest(`/rest/v1/precios_cache`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(fila),
  }).catch(() => {});
}

/* ── El contador diario ────────────────────────────────────────
   Solo se llama cuando la petición va a salir DE VERDAD a internet. Lo
   que se protege es la cuota de las APIs externas, y un dato servido
   desde la caché no gasta nada de eso. */
async function consumePeticion(userId, limite) {
  if (!sbConfigurado()) return { permitido: true, usadas: 0, limite_dia: limite };
  const r = await sbRest(`/rest/v1/rpc/consume_peticion`, {
    method: "POST",
    body: JSON.stringify({ quien: userId, limite }),
  });
  if (!r.ok) {
    // Si el contador falla, NO se bloquea a la gente: se deja pasar y se
    // anota. Un contador roto no debe dejar la aplicación inservible.
    return { permitido: true, usadas: 0, limite_dia: limite, aviso: `contador no disponible (${r.status})` };
  }
  const j = await r.json().catch(() => null);
  const fila = Array.isArray(j) ? j[0] : j;
  return fila || { permitido: true, usadas: 0, limite_dia: limite };
}

module.exports = {
  aplicarCORS,
  compruebaToken,
  leerCuerpoJSON,
  tokenDeCabecera,
  sbConfigurado,
  sbRest,
  usuarioDelToken,
  esMiembro,
  identifica,
  cacheLee,
  cacheGuarda,
  consumePeticion,
};

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
  res.setHeader("Access-Control-Max-Age", "86400");
}

// Devuelve true si la petición está autorizada. Si no lo está, ya ha
// escrito la respuesta 401 y el caller debe simplemente "return".
function compruebaToken(req, res) {
  const cabecera = req.headers["authorization"] || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
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

module.exports = { aplicarCORS, compruebaToken, leerCuerpoJSON };
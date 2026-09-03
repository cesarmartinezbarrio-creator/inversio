// POST /api/mcp-proxy  { servidor, herramienta, entrada }
//
// Sustituye a los conectores de claude.ai (window.claude.use("mcp").callTool)
// para que la app siga funcionando fuera de claude.ai. Llama directamente a
// las APIs reales de Twelve Data, Alpha Vantage y Crypto.com con las claves
// guardadas como secreto de Vercel, y devuelve la respuesta en la MISMA
// forma que el frontend ya sabe leer (ver js6-precios.js / js8-conectores.js
// del prompt original) para no tocar ni una línea de esa lógica.
//
// Formas ya verificadas el 30/08/2026 y documentadas en el proyecto:
//   Twelve Data get_price     -> {price:"..."}                (pasa tal cual)
//   Twelve Data search_symbol -> {result:"[...JSON string...]"} (se transforma)
//   Twelve Data get_quote     -> {result:"CSV;con;cabecera\nCSV;con;valores"} (se transforma)
//   Alpha Vantage / Crypto.com -> se reenvían tal cual, ya coinciden.

const {
  aplicarCORS, leerCuerpoJSON, identifica,
  cacheLee, cacheGuarda, consumePeticion,
} = require("./_common");

/* ── Cuánto aguanta cada dato antes de volver a preguntar ──────
   No es lo mismo un precio que el balance de una empresa. Poner a todo
   el mismo plazo sería o gastar cuota de más, o enseñar datos viejos.
   En segundos. */
const CADUCIDAD = {
  "Twelve Data:get_price": 300,             // 5 min
  "Twelve Data:get_quote": 300,
  "Twelve Data:search_symbol": 604800,      // una semana: los tickers no cambian
  "Alpha Vantage MCP Server:GLOBAL_QUOTE": 300,
  "Alpha Vantage MCP Server:CURRENCY_EXCHANGE_RATE": 3600,
  "Alpha Vantage MCP Server:SYMBOL_SEARCH": 604800,
  "Alpha Vantage MCP Server:ETF_PROFILE": 86400,
  "Alpha Vantage MCP Server:COMPANY_OVERVIEW": 86400,   // las cuentas salen cada trimestre
  "Crypto.com:get_ticker": 120,             // 2 min: el cripto se mueve deprisa
};

// La clave tiene que ser la misma para dos peticiones equivalentes aunque
// los argumentos vengan en distinto orden o con otras mayúsculas, o la
// caché no serviría de nada.
function claveCache(servidor, herramienta, entrada) {
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const partes = Object.keys(e).sort()
    .map((k) => `${k}=${String(e[k]).trim().toUpperCase()}`)
    .join("&");
  return `${servidor}:${herramienta}:${partes}`;
}

const LIMITE_DIARIO = () => parseInt(process.env.LIMITE_DIARIO || "300", 10);

const TD_KEY = () => process.env.TWELVE_DATA_KEY;
const AV_KEY = () => process.env.ALPHA_VANTAGE_KEY;

async function jsonOrThrow(r, servidor) {
  if (r.status === 429) { const e = new Error("rate_limited"); e.code = "rate_limited"; throw e; }
  if (!r.ok) { const e = new Error(`${servidor} respondió ${r.status}`); e.code = "tool_error"; throw e; }
  return r.json();
}

/* ── Twelve Data ──────────────────────────────────────────── */
async function twelveGetPrice(entrada) {
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(entrada.symbol)}&apikey=${TD_KEY()}`;
  const r = await fetch(url);
  const j = await jsonOrThrow(r, "Twelve Data");
  if (j.code && j.code >= 400) { const e = new Error(j.message || "error"); e.code = "tool_error"; throw e; }
  return j; // ya tiene forma {price:"..."}
}

async function twelveSearchSymbol(entrada) {
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(entrada.symbol)}&outputsize=${entrada.outputsize || 20}&apikey=${TD_KEY()}`;
  const r = await fetch(url);
  const j = await jsonOrThrow(r, "Twelve Data");
  const datos = Array.isArray(j.data) ? j.data : [];
  return { result: JSON.stringify(datos) };
}

async function twelveGetQuote(entrada) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(entrada.symbol)}&apikey=${TD_KEY()}`;
  const r = await fetch(url);
  const j = await jsonOrThrow(r, "Twelve Data");
  if (j.code && j.code >= 400) { const e = new Error(j.message || "sin cotización"); e.code = "tool_error"; throw e; }
  const fila = {
    name: j.name || "", exchange: j.exchange || "", currency: j.currency || "",
    close: j.close ?? "", percent_change: j.percent_change ?? "",
    fifty_two_week_low: j.fifty_two_week?.low ?? "", fifty_two_week_high: j.fifty_two_week?.high ?? "",
    datetime: j.datetime || "", is_market_open: String(!!j.is_market_open),
  };
  const cab = Object.keys(fila);
  const csv = cab.join(";") + "\n" + cab.map(k => fila[k]).join(";");
  return { result: csv };
}

/* ── Alpha Vantage — reenvío casi directo ────────────────────
   La función real de "COMPANY_OVERVIEW" en la API de Alpha Vantage
   se llama "OVERVIEW"; el resto de nombres coinciden.            */
const FUNCION_ALPHA = {
  GLOBAL_QUOTE: "GLOBAL_QUOTE",
  CURRENCY_EXCHANGE_RATE: "CURRENCY_EXCHANGE_RATE",
  SYMBOL_SEARCH: "SYMBOL_SEARCH",
  ETF_PROFILE: "ETF_PROFILE",
  COMPANY_OVERVIEW: "OVERVIEW",
};

async function llamarAlpha(herramienta, entrada) {
  const fn = FUNCION_ALPHA[herramienta];
  if (!fn) { const e = new Error("herramienta desconocida"); e.code = "not_in_manifest"; throw e; }
  const params = new URLSearchParams({ function: fn, apikey: AV_KEY() });
  for (const [k, v] of Object.entries(entrada || {})) {
    if (k === "datatype") continue; // siempre json
    params.set(k, v);
  }
  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  const r = await fetch(url);
  const j = await jsonOrThrow(r, "Alpha Vantage");
  if (j.Note || j.Information) { const e = new Error(j.Note || j.Information); e.code = "rate_limited"; e.retryable = false; throw e; }
  return j;
}

/* ── Crypto.com — reenvío directo, ya coincide con lo que la
   app espera en p.result.data[0].a                            */
async function cryptoGetTicker(entrada) {
  const url = `https://api.crypto.com/v2/public/get-ticker?instrument_name=${encodeURIComponent(entrada.instrument_name)}`;
  const r = await fetch(url);
  return jsonOrThrow(r, "Crypto.com");
}

module.exports = async (req, res) => {
  aplicarCORS(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ code: "tool_error" }); return; }

  const quien = await identifica(req, res);
  if (!quien) return;

  const { servidor, herramienta, entrada } = await leerCuerpoJSON(req);
  if (!servidor || !herramienta) { res.status(400).json({ code: "tool_error", message: "Falta servidor o herramienta." }); return; }

  // 1) ¿Lo ha preguntado alguien hace poco? Entonces esto no cuesta nada:
  //    ni cuota de la API, ni cuota del usuario.
  const clave = claveCache(servidor, herramienta, entrada);
  const guardado = await cacheLee(clave);
  if (guardado) {
    res.setHeader("X-Cache", "hit");
    res.status(200).json({ payload: guardado });
    return;
  }

  // 2) Va a salir a internet de verdad. Aquí sí se cuenta.
  if (quien.tipo === "usuario") {
    const uso = await consumePeticion(quien.id, LIMITE_DIARIO());
    res.setHeader("X-Uso-Hoy", String(uso.usadas ?? 0));
    res.setHeader("X-Limite-Dia", String(uso.limite_dia ?? LIMITE_DIARIO()));
    if (!uso.permitido) {
      res.status(429).json({
        code: "rate_limited",
        message: `Has llegado al máximo de ${uso.limite_dia} consultas de mercado por hoy. Se reinicia esta noche; los datos que ya tienes guardados siguen ahí.`,
        retryable: false,
      });
      return;
    }
  }

  try {
    let payload;
    if (servidor === "Twelve Data") {
      if (!TD_KEY()) { const e = new Error("falta clave"); e.code = "server_not_connected"; throw e; }
      if (herramienta === "get_price") payload = await twelveGetPrice(entrada);
      else if (herramienta === "search_symbol") payload = await twelveSearchSymbol(entrada);
      else if (herramienta === "get_quote") payload = await twelveGetQuote(entrada);
      else { const e = new Error("herramienta desconocida"); e.code = "not_in_manifest"; throw e; }
    } else if (servidor === "Alpha Vantage MCP Server") {
      if (!AV_KEY()) { const e = new Error("falta clave"); e.code = "server_not_connected"; throw e; }
      payload = await llamarAlpha(herramienta, entrada);
    } else if (servidor === "Crypto.com") {
      if (herramienta === "get_ticker") payload = await cryptoGetTicker(entrada);
      else { const e = new Error("herramienta desconocida"); e.code = "not_in_manifest"; throw e; }
    } else {
      const e = new Error("servidor desconocido"); e.code = "server_not_found"; throw e;
    }
    // 3) Guardar para el siguiente. Los errores NO se guardan: si Twelve
    //    Data falla un momento, no queremos servir ese fallo cinco minutos.
    const segundos = CADUCIDAD[`${servidor}:${herramienta}`];
    if (segundos) await cacheGuarda(clave, payload, segundos);

    res.setHeader("X-Cache", "miss");
    res.status(200).json({ payload });
  } catch (err) {
    const code = err.code || "tool_error";
    const status = code === "rate_limited" ? 429 : code === "server_not_connected" ? 424 : 502;
    res.status(status).json({ code, message: err.message, retryable: code === "server_unavailable" });
  }
};

// GET  /api/estado  -> devuelve el último estado guardado (o null si no hay ninguno)
// POST /api/estado  -> guarda el estado que llega en el cuerpo (JSON completo de S)
//
// Guarda una única fila en Supabase (id fijo "principal"): esto es una app
// de una sola persona, no hace falta más. Las credenciales de Supabase son
// el rol de servicio, así que esta función NUNCA debe llamarse sin el
// token de compruebaToken() delante.

const { aplicarCORS, compruebaToken, leerCuerpoJSON } = require("./_common");

module.exports = async (req, res) => {
  aplicarCORS(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (!compruebaToken(req, res)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({ code: "server_unavailable", message: "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en Vercel." });
    return;
  }
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/estado`;
  const cabecerasSupabase = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  if (req.method === "GET") {
    try {
      const r = await fetch(`${base}?id=eq.principal&select=json,actualizado`, { headers: cabecerasSupabase });
      if (!r.ok) { res.status(502).json({ code: "server_unavailable" }); return; }
      const filas = await r.json();
      if (!filas.length) { res.status(200).json(null); return; }
      res.status(200).json(filas[0].json);
    } catch (err) {
      res.status(502).json({ code: "server_unavailable", message: String(err) });
    }
    return;
  }

  if (req.method === "POST") {
    const cuerpo = await leerCuerpoJSON(req);
    if (!cuerpo || typeof cuerpo !== "object" || !Array.isArray(cuerpo.apuntes)) {
      res.status(400).json({ code: "tool_error", message: "El estado que has enviado no parece válido (falta 'apuntes')." });
      return;
    }
    try {
      const r = await fetch(`${base}?on_conflict=id`, {
        method: "POST",
        headers: { ...cabecerasSupabase, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ id: "principal", json: cuerpo, actualizado: new Date().toISOString() }]),
      });
      if (!r.ok) {
        const texto = await r.text().catch(() => "");
        res.status(502).json({ code: "server_unavailable", message: texto });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(502).json({ code: "server_unavailable", message: String(err) });
    }
    return;
  }

  res.status(405).json({ code: "tool_error", message: "Método no soportado." });
};

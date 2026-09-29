// Latido diario: evita que Supabase pause el proyecto por inactividad.
//
// El plan gratuito de Supabase pausa el proyecto tras unos 7 días sin
// actividad. Cuando pasa, su dirección deja de existir y la página de
// acceso solo dice «Failed to fetch» (nos pasó el 29/09/2026).
//
// Vercel llama a esta función una vez al día (ver "crons" en vercel.json).
// Hace una lectura mínima en la base de datos —una fila de la caché de
// precios, que no es de nadie— y no devuelve ningún dato.
//
// Si en Vercel existe la variable CRON_SECRET, Vercel la manda sola en la
// cabecera Authorization y aquí se exige; así nadie de fuera puede
// dispararla a lo loco. Sin esa variable funciona igual.

const { sbConfigurado, sbRest, tokenDeCabecera } = require("./_common");

module.exports = async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (secreto && tokenDeCabecera(req) !== secreto) {
    res.status(401).json({ ok: false });
    return;
  }
  if (!sbConfigurado()) {
    res.status(500).json({ ok: false, error: "Supabase sin configurar" });
    return;
  }
  try {
    const r = await sbRest("/rest/v1/precios_cache?select=clave&limit=1");
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, supabase: r.status, cuando: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
};

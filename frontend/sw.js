/* Service worker de Cuentas y Cartera.
 *
 * REGLA INNEGOCIABLE DE ESTE FICHERO
 * ══════════════════════════════════
 * Aquí SOLO se guarda en caché el armazón de la aplicación: el HTML, el
 * manifiesto y los iconos. Los datos del usuario NO se cachean jamás.
 *
 * El motivo no es técnico, es de seguridad. Las peticiones al backend
 * (/api/estado, /api/mcp-proxy) van a otro dominio y llevan dentro la
 * cartera de una persona. Si se quedaran guardadas en la caché del
 * navegador, sobrevivirían al cierre de sesión y quedarían legibles para
 * cualquiera que use ese ordenador después. Por eso, más abajo, todo lo que
 * no sea de este mismo origen se deja pasar sin tocarlo.
 *
 * Cuando la app tenga varios usuarios, esta regla es lo que impide que el
 * perfil de uno se le quede pegado al navegador del siguiente.
 */

const VERSION = "cyc-v1";
const ARMAZON = [
  "/",
  "/index.html",
  "/manifest.json",
  "/iconos/icono-192.png",
  "/iconos/icono-512.png",
  "/iconos/icono-192-maskable.png",
  "/iconos/icono-512-maskable.png",
  "/iconos/apple-touch-icon.png",
  "/iconos/favicon-32.png",
];

/* Al instalar: se descarga el armazón. Si algún fichero falla no se aborta
   la instalación entera, para no dejar la app sin service worker por un
   icono que falte. */
self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(ARMAZON.map(u => cache.add(u)));
    self.skipWaiting();
  })());
});

/* Al activar: se borran las cachés de versiones anteriores. */
self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", ev => {
  const req = ev.request;

  // 1. Solo se gestionan lecturas simples. Un POST nunca se cachea.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 2. TODO lo que no sea de este mismo origen se deja pasar intacto:
  //    las llamadas al backend, a las APIs de mercado, a cualquier sitio.
  //    Ni se intercepta, ni se guarda, ni se mira.
  if (url.origin !== self.location.origin) return;

  // 3. Por si algún día el backend vive en el mismo dominio: nada que
  //    empiece por /api/ se cachea, bajo ningún concepto.
  if (url.pathname.startsWith("/api/")) return;

  // 4. El HTML va "primero la red": si hay conexión siempre ves la última
  //    versión publicada, y si no la hay, tiras de la copia guardada. Así
  //    una actualización llega sola sin que nadie tenga que vaciar nada.
  const esNavegacion = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (esNavegacion) {
    ev.respondWith((async () => {
      try {
        const red = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put("/index.html", red.clone());
        return red;
      } catch (_) {
        const guardado = await caches.match("/index.html");
        return guardado || Response.error();
      }
    })());
    return;
  }

  // 5. El resto del armazón (iconos, manifiesto) va "primero la caché",
  //    que no cambia casi nunca y así arranca instantáneo.
  ev.respondWith((async () => {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    try {
      const red = await fetch(req);
      const cache = await caches.open(VERSION);
      cache.put(req, red.clone());
      return red;
    } catch (_) {
      return Response.error();
    }
  })());
});

/* Permite que la página pida una actualización inmediata del worker. */
self.addEventListener("message", ev => {
  if (ev.data === "actualizar") self.skipWaiting();
});

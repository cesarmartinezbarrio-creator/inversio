// Servidor estático mínimo, sin dependencias, para las pruebas.
// Sirve la carpeta frontend/ y, para lo que no encuentre ahí (por ejemplo
// la foto de tique de las pruebas), tira de tests/fixtures/.
const http = require("http");
const fs = require("fs");
const path = require("path");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".wasm": "application/wasm",
  ".gz": "application/gzip", ".woff2": "font/woff2", ".traineddata": "application/octet-stream",
};

function arranca(puerto, raices){
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || "/").split("?")[0]);
    if (rel === "/" || rel === "") rel = "/index.html";
    rel = rel.replace(/\.\.+/g, "");                 // nada de subir de carpeta
    for (const base of raices){
      const f = path.join(base, rel);
      if (fs.existsSync(f) && fs.statSync(f).isFile()){
        res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
        fs.createReadStream(f).pipe(res);
        return;
      }
    }
    res.writeHead(404); res.end("no encontrado: " + rel);
  });
  return new Promise(resolve => srv.listen(puerto, () => resolve(srv)));
}

module.exports = { arranca };

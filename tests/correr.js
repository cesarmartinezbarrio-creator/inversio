// Un solo comando para todas las pruebas: `npm test`.
//
// Arranca un servidor estático de frontend/ (más tests/fixtures/), y luego
// ejecuta cada batería en su propio proceso. Cada batería abre su navegador,
// prueba una parte de la aplicación e imprime un «N/N». Al final se resume.
//
// Requisitos la primera vez, en un ordenador normal:
//     npm install
//     npx playwright install chromium
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { arranca } = require("./servir");

const RAIZ      = path.resolve(__dirname, "..");
const FRONTEND  = path.join(RAIZ, "frontend");
const FIXTURES  = path.join(__dirname, "fixtures");
const PUERTO    = 8902;

// Las baterías, en orden. Cada una es autónoma.
const SUITES = [
  "mosaico", "categorias", "prueba2", "rehacer", "veredicto",
  "vered2", "sin_camara", "xss", "estres", "extras", "invitacion",
];

(async () => {
  const srv = await arranca(PUERTO, [FRONTEND, FIXTURES]);
  console.log(`Servidor de pruebas en http://localhost:${PUERTO} (frontend + fixtures)\n`);

  // Carpeta temporal para las capturas y descargas de las pruebas.
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), "cyc-tests-"));

  // Entorno para los procesos hijos. Si estamos en el entorno de
  // construcción (con playwright-core y Chromium en /opt), se lo pasamos;
  // en un ordenador normal no hace falta, Playwright se apaña solo.
  const env = { ...process.env, CYC_OUT: salida };
  const OPT_CORE = "/opt/node-tools/node_modules/playwright-core";
  const OPT_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (fs.existsSync(OPT_CORE))   env.PW_CORE = OPT_CORE;
  if (fs.existsSync(OPT_CHROME)) env.PW_EXEC = OPT_CHROME;
  if (fs.existsSync(OPT_CORE))   env.NODE_PATH = OPT_CORE + "/..";

  // Importante: los hijos se lanzan de forma ASÍNCRONA. Si se usara una
  // versión síncrona (spawnSync), el bucle de eventos de este proceso se
  // quedaría bloqueado y el servidor de arriba —que vive aquí mismo— no
  // podría atender al navegador del hijo: las peticiones caducarían.
  const corre = (fichero) => new Promise(resolve => {
    const cp = spawn(process.execPath, [fichero], { env });
    let out = "";
    cp.stdout.on("data", d => out += d);
    cp.stderr.on("data", d => out += d);
    cp.on("close", code => resolve({ code, out }));
  });

  const resumen = [];
  for (const s of SUITES){
    process.stdout.write(`\n──────── ${s} ────────\n`);
    const { code, out } = await corre(path.join(__dirname, s + ".js"));
    process.stdout.write(out.split("\n").filter(l => /OK|MAL|\d+\/\d+|error/i.test(l)).join("\n") + "\n");
    // La puntuación de cada batería es una línea que EMPIEZA por «N/N»
    // (a veces con un sufijo, como «9/9 · OCR en 3 s»). Se coge la última
    // de esas, para no confundirla con un «0/10» que aparezca dentro de un
    // mensaje informativo.
    const puntis = out.split("\n").map(l => l.trim()).filter(l => /^\d+\/\d+/.test(l));
    const ultimo = puntis.length ? puntis[puntis.length - 1] : null;
    const [ok, total] = ultimo ? ultimo.match(/^(\d+)\/(\d+)/).slice(1).map(Number) : [0, 0];
    const bien = code === 0 && total > 0 && ok === total;
    resumen.push({ s, ok, total, bien });
  }

  srv.close();

  console.log("\n══════════ RESUMEN ══════════");
  let todoBien = true;
  for (const x of resumen){
    console.log(`${x.bien ? " OK  " : " MAL "} ${x.s.padEnd(12)} ${x.ok}/${x.total}`);
    if (!x.bien) todoBien = false;
  }
  const sumaOk = resumen.reduce((a, x) => a + x.ok, 0);
  const sumaT  = resumen.reduce((a, x) => a + x.total, 0);
  console.log(`\n${sumaOk}/${sumaT} comprobaciones · ${resumen.length} baterías`);
  console.log(todoBien ? "Todo en verde." : "Hay baterías en rojo (arriba).");
  process.exit(todoBien ? 0 : 1);
})();

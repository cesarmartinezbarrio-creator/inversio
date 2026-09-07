// Resuelve Playwright y la configuración de arranque de forma portable.
// - En un ordenador normal: `npm install` trae "playwright" y
//   `npx playwright install chromium` trae el navegador; aquí no hace
//   falta indicar la ruta, Playwright la encuentra sola.
// - En el entorno donde se construyó el proyecto, el runner pasa por
//   variables de entorno dónde está playwright-core y el Chromium.
let chromium;
try { ({ chromium } = require("playwright")); }
catch (_) {
  try { ({ chromium } = require("playwright-core")); }
  catch (__) { ({ chromium } = require(process.env.PW_CORE || "playwright-core")); }
}

const os = require("os");

// Opciones de lanzamiento comunes a todas las baterías.
const LAUNCH = {
  args: ["--no-first-run", "--disable-component-update", "--no-default-browser-check", "--disable-background-networking"],
};
if (process.env.PW_EXEC) LAUNCH.executablePath = process.env.PW_EXEC;

// Carpeta donde cada batería deja sus capturas y ficheros temporales.
const OUT = process.env.CYC_OUT || os.tmpdir();

module.exports = { chromium, LAUNCH, OUT };

# Pruebas de Cuentas y Cartera

Once baterías que abren la aplicación en un navegador de verdad y comprueban,
sin tocar producción, que lo importante funciona: el mosaico del mes, las
categorías propias, la suma de tiques, el veredicto de mercado, el lector de
tiques, que no entra ningún XSS, el aguante ante entradas absurdas, la copia
de seguridad y el modo demo, y el canje de invitaciones.

## Correrlas todas

```
npm install                    # la primera vez
npx playwright install chromium   # la primera vez (baja el navegador)
npm test
```

Sale un resumen con cada batería y su puntuación; termina en verde si todo
pasa, y devuelve código de error si algo falla (útil para integración
continua).

## Cómo está montado

- `correr.js` — arranca un servidor estático de `../frontend` (más
  `fixtures/`) y ejecuta cada batería en su propio proceso. **Ojo**: lanza los
  procesos de forma asíncrona a propósito; el servidor vive en este mismo
  proceso y una versión síncrona lo dejaría sordo mientras corre cada prueba.
- `servir.js` — el servidor estático, sin dependencias.
- `_pw.js` — resuelve Playwright y el navegador de forma portable.
- `fixtures/` — ficheros que piden algunas pruebas (la foto de un tique).
- Cada `*.js` restante es una batería independiente.

## Añadir una batería

Copia una existente como plantilla, ponla en esta carpeta, imprime al final
una línea que **empiece** por `N/N` (aciertos/total) y añade su nombre a la
lista `SUITES` de `correr.js`.

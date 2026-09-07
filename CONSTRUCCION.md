# Cómo se ha construido Cuentas y Cartera · paso a paso

Este documento cuenta, en orden, **cómo está hecha la aplicación de punta a
punta**: qué se montó primero, qué decisión se tomó en cada bifurcación y qué
trampas costaron una tarde. Sirve para dos cosas: recordar por qué las cosas
son como son, y poder reconstruirlo desde cero si algún día hiciera falta.

Los otros documentos cubren cada cara por separado:
- `README.md` — qué es y qué resuelve.
- `ARQUITECTURA.md` — el porqué de las decisiones de fondo.
- `MAPA.md` — dónde está cada cosa dentro del código.
- `SEGURIDAD.md` y `SEGURIDAD-REVISION-2026-09-07.md` — el modelo de amenaza y la auditoría.
- `AVERIAS.md` — el diario de fallos y arreglos.
- `DESPLIEGUE.md` e `INVITACIONES.md` — operación del día a día.

---

## La idea de fondo, en dos líneas

Toda la aplicación es **un único fichero HTML** (`frontend/index.html`) sin
compilación ni framework: se abre y funciona. Y la seguridad **no vive en ese
fichero, vive en la base de datos** (PostgreSQL con Row Level Security): aunque
alguien reescriba el JavaScript de la página, la base de datos sigue diciendo
que no. Todo lo demás es consecuencia de estas dos decisiones.

---

## Lo que hace falta tener antes de empezar

- Una cuenta de **Supabase** (base de datos + autenticación).
- Una cuenta de **Vercel** (el backend serverless de `api/`).
- Un hosting con **Hostinger** para servir el frontend en `ahorrainvierte.es`.
- Claves de datos de mercado: **Twelve Data** y **Alpha Vantage** (gratuitas).

---

## Paso 1 · El frontend de un solo fichero

`frontend/index.html` contiene el HTML, el CSS (dentro de `<style>`) y todo el
JavaScript (dentro de un único `<script>`). No hay build. Ventajas: se lee
entero, se despliega copiándolo, y el service worker puede cachearlo como un
bloque. El precio —y se asume a conciencia— es que la CSP necesita
`'unsafe-inline'` para el script; la defensa real contra XSS es que **todo dato
de usuario pasa por `esc()`** antes de tocar el HTML.

El estado de la aplicación es un objeto `S` que se serializa a JSON. Se guarda
en dos sitios: en `localStorage` (para abrir sin conexión) y en la base de
datos (para verlo desde cualquier dispositivo).

## Paso 2 · La base de datos y el aislamiento entre usuarios

En Supabase → SQL Editor, en este orden:

1. `supabase/schema.sql` — tabla inicial (histórico de la época de un solo usuario).
2. `supabase/multiusuario.sql` — la tabla `perfiles_estado`, una fila por
   usuario, con **RLS activado**. Las políticas usan `auth.uid()`, que lo
   resuelve PostgreSQL leyendo el JWT: la aplicación no lo pasa, así que no
   puede mentir. Cada quien solo ve y toca su fila.

> **Trampa nº 1, la que más cara salió.** En Supabase, activar RLS y escribir
> políticas **no basta**: PostgreSQL comprueba primero los *permisos de tabla*
> (`grant`), y esos ya no se conceden solos a las tablas nuevas. Sin
> `grant select, insert, update ... to authenticated`, la base responde
> `42501: permission denied` **antes** de mirar las políticas, y el error no
> menciona RLS por ningún sitio. `bypassrls` del rol de servicio se salta las
> políticas, pero **tampoco** te da permisos de tabla: son cosas distintas.

## Paso 3 · Registro por invitación

`supabase/invitaciones.sql`: cualquiera puede crear cuenta, pero sin canjear un
código válido **no es miembro**, y sin ser miembro la base no le deja leer ni
escribir nada. La tabla `invitaciones` tiene RLS y **cero políticas**: nadie la
lee desde el navegador, ni para comprobar si un código existe. El canje lo hace
una función `security definer` con `set search_path = public` (sin eso, se la
podría engañar creando tablas con el mismo nombre en otro esquema).

Endurecimientos posteriores:
- **Códigos aleatorios** en vez de adivinables (`INV-XXXXXXXX`): ver
  `supabase/empezar-de-cero.sql`.
- **Freno a la fuerza bruta** (`supabase/limite-invitaciones.sql`): un máximo
  de intentos fallidos por hora y usuario. Detalle clave: la función **no usa
  `raise`** para los fallos de código, porque `raise` revierte la transacción
  entera y con ella el contador de intentos; en su lugar devuelve un **estado
  en texto** y es `acceso.html` quien lo traduce a un mensaje.

## Paso 4 · El backend: el proxy de mercado

`api/` son funciones serverless en Vercel. `api/mcp-proxy.js` llama a las APIs
de mercado (Twelve Data, Alpha Vantage, Crypto.com) con las claves guardadas
como **secretos de Vercel** (nunca en el navegador) y devuelve los datos en la
forma que el frontend ya sabe leer. `api/_common.js` centraliza CORS, la
identificación del usuario (le pregunta a Supabase quién es el token, no
descifra el JWT a mano) y el acceso con la clave de servicio.

> **Trampa nº 2.** Hubo un `APP_TOKEN` compartido de la época de un solo
> usuario que abría el backend sin sesión. Se retiró de Vercel
> (`supabase/cerrar-puerta-vieja.sql`, paso 4, manual) y se borró la tabla
> vieja. Lección: una puerta de servicio "temporal" hay que cerrarla a
> propósito, no se cierra sola.

## Paso 5 · Caché y límites de mercado

`supabase/cache-y-limites.sql`: la cuota de las APIs de mercado es de la
aplicación entera, no de cada persona. Dos piezas, ambas en la base porque son
comunes a todos: `precios_cache` (si alguien ya preguntó AAPL hace tres
minutos, el siguiente no gasta cuota) y `uso_diario` (tope de peticiones reales
por usuario y día). Las dos con RLS y sin acceso desde el navegador: lo que
nadie puede tocar, nadie lo puede envenenar.

## Paso 6 · El lector de tiques (OCR en el propio móvil)

La foto de un tique se lee **dentro del navegador** con Tesseract.js
autoalojado en `frontend/vendor/tesseract/`; la imagen no sale del dispositivo.
En cuanto se apunta el número, la foto se descarta.

> **Trampa nº 3.** `workerBlobURL: false` es obligatorio: un worker servido
> desde un `blob:` no sabe resolver la ruta relativa de su `.wasm` y se queda
> colgado en silencio (90 s de espera). Con la ruta directa, 1,2 s. Y la CSP
> necesita `'wasm-unsafe-eval'` + `worker-src 'self' blob:`; ojo con
> `Permissions-Policy: camera=()`, que llega a bloquear la cámara de la propia
> página.

## Paso 7 · La economía del mes: el mosaico

`Mi economía → El mes` es un **mosaico de azulejos**, uno por categoría con su
cifra grande. La clave de diseño: el mosaico se guía por **el dinero**
(apuntes del mes + categorías ancladas), no por una lista fija de etiquetas.
Así cada usuario empieza en blanco y escribe sus propias categorías; anclar una
con la chincheta la hace volver sola cada mes. Los tiques **suman** dentro de su
categoría, y el detalle enseña el desglose con un gráfico circular.

## Paso 8 · Mercado: el veredicto

La ficha de un producto abre con una tarjeta de veredicto: un porcentaje grande
y una palabra con color —**Invertir · Observar · No invertir**— que se puede
pulsar para ver, en cristiano, por qué. El porcentaje es la proporción de
comprobaciones que salen bien; **no** es la probabilidad de ganar dinero, y la
propia tarjeta lo dice. El juicio cruza dos reglas y se queda con la peor: una
comprobación crítica en rojo manda por encima de la nota.

## Paso 9 · Copia de seguridad, versión y modo demo

- **Copia de seguridad**: el botón de datos (icono de la barra) descarga todo
  tu estado a un fichero JSON y lo vuelve a cargar si hace falta.
- **Sello de versión** (`VERSION_APP`): visible en ese mismo diálogo, para
  saber qué build corre.
- **Modo demo** (`?demo` en la URL): arranca sin sesión, con datos de ejemplo
  generados al azar, y **sin guardar nada**. Es lo que embebe la web de guía.

## Paso 10 · Seguridad

`frontend/.htaccess` fija las cabeceras en producción: CSP, HSTS,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
`supabase/revision-seguridad.sql` comprueba tabla por tabla que el candado está
echado y que `anon` no aparece donde no debe. La auditoría del 7/9/2026
(ataques reales contra producción) está en `SEGURIDAD-REVISION-2026-09-07.md`:
sin brecha de datos.

## Paso 11 · Las pruebas

`npm test` (ver `tests/LEEME.md`) levanta un servidor del frontend y corre
once baterías en un navegador de verdad: mosaico, categorías, suma de tiques,
veredicto, lector de tiques, XSS, estrés, copia de seguridad, modo demo y canje
de invitaciones. La primera vez: `npm install` y `npx playwright install
chromium`.

> **Trampa nº 4.** En el runner, el servidor vive en el mismo proceso que
> orquesta las pruebas; lanzar las baterías de forma **síncrona** dejaría el
> servidor sordo mientras corre cada una y las peticiones caducarían. Por eso
> se lanzan de forma asíncrona.

## Paso 12 · Despliegue

- **Vercel** (el backend `api/`) se despliega solo al hacer `git push`, con su
  integración de GitHub. Los secretos (`SUPABASE_*`, `TWELVE_DATA_KEY`,
  `ALPHA_VANTAGE_KEY`, `ALLOWED_ORIGIN`) se ponen en Settings → Environment
  Variables.
- **Hostinger** (el frontend) se sube por FTP con el workflow
  `.github/workflows/deploy-frontend.yml`, o a mano al `public_html` del
  dominio.

> **Trampa nº 5.** Por FTP se entra en la carpeta personal, que tiene un
> `public_html` genérico que **no** es el del dominio. El del dominio vive en
> `domains/ahorrainvierte.es/public_html`. Apuntar al genérico deja el
> despliegue en verde y la web sin cambiar.

## Empezar de cero y mantenimiento

- `supabase/empezar-de-cero.sql` — borra todas las cuentas y datos (deja una
  copia previa) y crea códigos de invitación aleatorios.
- Borrar cuentas concretas: desde Supabase → Authentication → Users → Delete
  (por SQL no siempre funciona; la tabla `auth.users` está protegida en el
  editor).

## El resumen de trampas

1. RLS ≠ permisos de tabla: sin `grant`, `42501` antes de evaluar políticas.
2. Puertas de servicio temporales (`APP_TOKEN`) hay que cerrarlas a mano.
3. OCR: `workerBlobURL:false`, y CSP con `wasm-unsafe-eval` sin bloquear la cámara.
4. Un servidor y un `spawnSync` en el mismo proceso se estorban.
5. Dos `public_html` que parecen el mismo y no lo son.
6. Contar caracteres (`text.length`) no es contar bytes: engaña al comparar tamaños de fichero.

# Mapa del proyecto

Este archivo existe para una cosa: que cualquiera —yo en una sesión nueva, o tú
dentro de seis meses— sepa dónde está cada cosa sin tener que abrir un fichero de
6.900 líneas a ver qué encuentra.

No explica *cómo funciona* la aplicación: eso está en `ARQUITECTURA.md`. Esto es
el índice.

**Nombre**: Cuentas y Cartera · **Dominio**: ahorrainvierte.es · **Idioma**: todo en español, código incluido.

---

## 1 · Los cuatro sitios donde vive el proyecto

| Sitio | Qué hay | Quién lo toca |
|---|---|---|
| **GitHub** (repo `inversio`) | Todo el código | Se sube con `git push` desde VS Code |
| **Hostinger** (`public_html`) | Solo `index.html`, `acceso.html`, `.htaccess`, `manifest.json`, `sw.js`, `iconos/` | Subida manual por FTP/gestor de archivos |
| **Vercel** | La carpeta `api/` — el backend | Despliega solo al hacer push |
| **Supabase** | La base de datos y las cuentas | Los `.sql` se pegan a mano en el editor SQL |

Lo importante de esta tabla: **el frontend y el backend no viven en el mismo
sitio**. Cambiar `index.html` no se despliega solo; hay que subirlo a Hostinger.
Cambiar `api/*.js` sí se despliega solo con el push.

---

## 2 · El árbol de ficheros

```
inversio/
├─ frontend/
│  ├─ index.html      428 KB · LA APLICACIÓN ENTERA (ver §3)
│  ├─ acceso.html      32 KB · registro, entrada, confirmación (ver §4)
│  ├─ .htaccess              · cabeceras de seguridad (HSTS, CSP…)
│  ├─ vendor/tesseract/      · 5,1 MB · el motor de OCR de los tiques (ver §3b)
│  ├─ manifest.json          · para instalarla como app en el móvil
│  ├─ sw.js                  · service worker
│  └─ iconos/                · 6 PNG
├─ api/
│  ├─ _common.js             · sesión, CORS, caché, cupos (ver §5)
│  └─ mcp-proxy.js           · el único endpoint público
├─ supabase/                 · los scripts SQL (ver §6)
├─ docs/img/                 · capturas para el README
├─ .github/workflows/
│  └─ deploy-frontend.yml    · despliegue FTP — NO FUNCIONA, ver §8
└─ *.md                      · la documentación (ver §7)
```

**Regla que no se salta**: cada vez que se crea o modifica un fichero, se escribe
en `C:\Personal\inversio-despliegue\inversio` y se da el comando de commit.

---

## 3 · Dentro de `frontend/index.html`

Un solo fichero, 6.922 líneas: HTML, CSS y JavaScript juntos. No es descuido —
así se puede abrir desde el móvil sin instalar nada y no hay proceso de compilado.
El precio es que hay que saber navegarlo.

**Los números de línea envejecen.** Para encontrar una sección, mejor buscar su
título; están todos marcados con una banda `═══`:

```bash
grep -n '^   [A-ZÁÉÍÓÚÑ]' frontend/index.html   # los títulos de sección
grep -n '^function \|^async function ' frontend/index.html   # las funciones
```

### Orden de las secciones (a 05/09/2026)

| Línea | Sección | Qué contiene |
|---|---|---|
| 1300 | CUENTAS Y CARTERA | Constantes, modelo de datos, `saneaEstado`, persistencia |
| 1690 | Cálculo | Fórmulas fijas: KPIs, cartera, rentabilidad, escenarios |
| 1700 | Escala de color de la ganancia | La misma paleta rojo→verde en toda la app |
| 2132 | Cada producto con su vara | Semáforos por tipo (acción, ETF, fondo…) |
| 2591 | Gráficos | SVG a mano: líneas, barras, apiladas, área, tooltips |
| 2823 | Gráficas de evolución | Área con degradado, anillos, minis |
| 3108 | Piezas de interfaz | `info`, `listaAvisos`, `irA` |
| 3172 | **PORTADA** | `renderPortada` — la pantalla de inicio |
| 3332 | MI ECONOMÍA · El mes | `renderMes`, `renderDetalle` |
| 3549 | MI ECONOMÍA · Evolución | `renderEvolucion`, `renderSalud` |
| 3775 | INVERSIÓN · Cartera | `renderCartera`, `fichaPosicion` |
| 3975 | INVERSIÓN · Escenarios | `renderEscenarios` |
| 4030 | INVERSIÓN · Señales | `renderSenales` |
| 4077 | INVERSIÓN · Precios | `renderPrecios`, `peticionPrecios` |
| 4132 | MERCADO · Lista de fichas | `renderEstudio` + los paneles de análisis |
| 4424 | MERCADO · La ficha | `renderFicha` — la pantalla más grande. Empieza por `tarjetaVeredicto` (ver §3c) |
| 4747 | MERCADO · Observación | `renderObservacion` |
| 4797 | MERCADO · Cómo se valora | `renderMetodo` |
| 4892 | INTERÉS COMPUESTO | `renderCompuesto` |
| 4969 | Lector de PDF | pdf.js en local; el fichero **no** se sube a ningún sitio |
| ~5340 | **Lector de tiques** | Tesseract en local: `analizaTique`, `leerTique`, `confirmarTique` |
| 5339 | Precios en vivo | `precioDeUno`, `actualizarPreciosEnVivo` |
| 5554 | Buscar un producto | `buscarProducto`, `traerDatos`, `elegirResultado` |
| 5962 | Prompt de extracción | El texto que se copia para pegar en Claude |
| 6011 | Render | `render()` y `pintaTabs()` — el despachador |
| 6051 | Globo de información | Tooltips con retardo |
| 6102 | Avisos | `abrirAvisos`, `marcarVistos` |
| 6149 | Apuntes | Diálogos de inversión: `guardarInv`, `cerrarPosicion` |
| 6254 | Eventos | **390 líneas** de `addEventListener`. Aquí se cuelga todo |
| 6665 | Guardado | `programarGuardado`, `guardarYa`, `pintaSync` |
| 6721 | Arranque | `init()` |
| 6724 | **Backend propio** | Sesión y llamadas: `leeSesion`, `llamaAPI`, `guardarEstadoNube` |

### El estado

Una sola variable global con todo dentro. Se guarda en `localStorage` bajo
`cyc.estado.v1` y se sincroniza con Supabase.

```
apuntes[]      · movimientos del mes (ingreso/gasto)
aportaciones[] · dinero metido en cada producto
activos[]      · LA CARTERA. Cada uno con estado:
                 estudio · observacion · cartera · cerrado
etiquetas{}    · categorías de ingresos y gastos
fijas[]        · gastos fijos mensuales
ajustes{}      · preferencias
mes, modulo, tab, periodo, ...  · dónde está el usuario ahora
```

`saneaEstado()` (línea ~1577) es el portero: **todo** lo que entra pasa por ahí y
se valida campo a campo. Si añades un campo nuevo al modelo, hay que añadirlo
también ahí o se pierde al recargar.

Detalle que se olvida: `saneaEstado` fuerza `modulo: "portada"` a propósito. La
app **siempre abre en Portada**, nunca en el último módulo visitado. Fue una
petición explícita; no lo "arregles".

---

### 3b · El lector de tiques

**Tres cosas que parecen detalles y no lo son.** Las tres costaron una tarde:

1. **No hay cámara, y no es un olvido.** Se probaron las dos formas que
   existen y ninguna funcionó en el móvil real:
   - `<input capture>` le pide la foto a la aplicación de cámara del
     teléfono. En un móvil con **perfil de trabajo** Android lo prohíbe («no
     se puede aceptar datos de trabajo desde una aplicación personal») y no
     hay forma de esquivarlo desde el código.
   - `getUserMedia` abre el vídeo dentro de la propia página, sin cruzar esa
     frontera. En el banco de pruebas funcionaba; en el aparato real, no.

   Así que el lector **solo carga imágenes ya hechas**. Se hace la foto con
   la cámara del móvil como siempre y luego se elige el fichero. Menos
   elegante, pero funciona. Por eso el `.htaccess` volvió a `camera=()`: si
   algún día se reintenta, hay que poner `camera=(self)` o el navegador lo
   bloquea todo, esta web incluida.
2. **`workerBlobURL: false` es obligatorio.** Por defecto el motor se ejecuta
   desde una URL `blob:`, y desde ahí no sabe resolver la ruta de su propio
   `.wasm`: la petición falla en silencio, la promesa nunca termina y la
   barra de progreso gira eternamente. Medido: colgado a los 90 s contra
   1,2 s cargándolo por su URL de verdad.
3. **El `.htaccess` tenía `camera=()`**, que prohíbe la cámara a todo el
   mundo, esta web incluida. Ahora es `camera=(self)`.

Y todas las esperas llevan límite de tiempo (`conLimite`). Una barra girando
sin fin no informa de nada y hace pensar que la aplicación está rota.



Hace **una** cosa: sacar el importe total de una foto y apuntarlo como un
gasto. No reconstruye la cesta de la compra, y es a propósito.

Medido sobre una foto degradada a propósito (torcida, con sombra, con ruido,
JPEG de móvil): **el total y la fecha salen bien; el desglose falla en 2 de
cada 8 líneas**. Un total correcto vale; una cesta con dos precios inventados
es peor que no tener nada. De ahí el alcance.

- El motor (Tesseract) se sirve desde `frontend/vendor/tesseract/`, **nunca
  desde un CDN**: si viniera de fuera, la CSP lo bloquearía y además la foto
  pasaría por un tercero.
- Se descarga **la primera vez que se usa**, no al abrir la app. Son 5,1 MB;
  después queda en la caché del navegador.
- La imagen se lee con `preparaFoto` (gris + contraste por percentiles) y se
  descarta con `URL.revokeObjectURL` al terminar. **No se guarda en ningún
  sitio**: ni en la base de datos, ni en `localStorage`, ni en el estado.
- La CSP del `.htaccess` necesita `'wasm-unsafe-eval'` y `worker-src blob:`.
  Si se toca ese `.htaccess`, el lector deja de arrancar sin decir por qué.

**Para regenerar el motor** si algún día hay que actualizarlo:

```
npm pack tesseract.js@5 tesseract.js-core@5 @tesseract.js-data/spa
```

y de ahí salen `dist/tesseract.min.js`, `dist/worker.min.js`,
`tesseract-core-simd-lstm.js` + `.wasm`, y `4.0.0_best_int/spa.traineddata.gz`.

### 3c · La tarjeta del veredicto

Lo primero que se ve al abrir una ficha: un porcentaje grande, y debajo una
palabra — **Invertir · Observar · No invertir** — con su color. Al pulsarla se
abre el «por qué»: una marca por comprobación, agrupadas en a favor, a
medias, en contra y sin datos, y la frase que explica qué ha decidido.

**Qué es ese porcentaje, y qué no.** Es la proporción de comprobaciones que
salen verdes, contando las medias como media (`puntuaVeredicto`). Las que no
tienen datos no cuentan: no se puede suspender por algo que no se ha podido
mirar. **No es la probabilidad de ganar dinero ni una previsión del precio**,
y la propia tarjeta lo dice. Fingir que un número así predice un resultado
financiero sería mentir sobre el dinero de alguien; lo que mide es cuánto
encaja el producto con los criterios que el usuario mismo fijó.

**El veredicto cruza dos reglas y se queda con la peor** (`estadoVeredicto`):
la del semáforo original —una comprobación crítica en rojo es «No invertir»
aunque saque un 90%— y la de la nota, que puede bajarlo pero **nunca
subirlo**. Aprobar por puntos algo que falla en lo esencial sería justo el
error que la lista existe para evitar. Antes de cruzarlas, una empresa que
suspendía 8 de 10 salía como «Observar» solo porque ninguna crítica estaba en
rojo, y un 17% en naranja no lo entiende nadie.

## 4 · Dentro de `frontend/acceso.html`

La puerta. Cuatro pantallas que se enseñan una cada vez con `muestra(...)`:

| `<section>` | Cuándo se ve |
|---|---|
| `#pasoAcceso` | Formulario de entrar / crear cuenta |
| `#pasoCorreo` | **"Confirma tu registro"** — el sobre con la carta saliendo (SVG a mano, sin imágenes) |
| `#pasoCodigo` | Canjear el código de invitación |
| `#pasoDentro` | Bienvenida con el anillo que se vacía en 10 s y entra sola |

Configuración en `<meta>`, arriba del todo: `supabase-url`, `supabase-key`
(la publicable, no pasa nada porque se vea), `destino`, `espera` (segundos del
anillo).

El anillo **se vacía**, no se llena: `@keyframes gasta` va de
`stroke-dashoffset: 0` a `326.7`. El número dentro es `#okCuenta`.

`tras_entrar(recienLlegado)` decide: si es una entrada normal va directo a la app;
la tarjeta de bienvenida solo sale tras registrarse o canjear código.

**El código de invitación se pide una vez, no dos.** Se escribe al crear la
cuenta y se guarda en `localStorage` bajo `cyc.codigo`; al volver del correo,
`tras_entrar` lo canjea solo y `#pasoCodigo` ni se ve. Esa pantalla sigue ahí
como red: salta si no hay código guardado (se confirmó desde otro dispositivo)
o si el guardado no vale, y en ese caso el guardado se borra para que no se
quede pegado. `salir()` también lo borra, por si el ordenador es compartido.

**Trampa conocida**: `cambiaModo()` termina llamando a `aviso(null)`, que borra el
mensaje en pantalla. Si escribes un aviso *antes* de `cambiaModo`, desaparece.
Este fallo ya nos costó una tarde.

**Trampa peor, y de la misma familia**: activar la confirmación por correo en
Supabase dejó código muerto sin avisar. El registro pasó a no devolver sesión,
y como canjear exige sesión, la línea que canjeaba quedó detrás de un `return`
y nunca se ejecutaba. El campo seguía ahí, pidiendo un dato que se tiraba. Si
cambias una opción de autenticación en el panel, repasa qué caminos del código
dejan de recorrerse.

---

## 5 · El backend (`api/`)

Dos ficheros. Un solo endpoint público: `/api/mcp-proxy`.

**`_common.js`** — lo compartido:

| Función | Para qué |
|---|---|
| `aplicarCORS` | Varios orígenes permitidos |
| `tokenDeCabecera` | Saca el token del `Authorization` |
| `usuarioDelToken` | **Le pregunta a Supabase** quién es. No descodifica el JWT por su cuenta |
| `esMiembro` | ¿Está en la tabla `miembros`? |
| `identifica` | Devuelve `{tipo:"usuario"}` |
| `cacheLee` / `cacheGuarda` | Caché de precios compartida entre todos |
| `consumePeticion` | Cupo diario por usuario. **Falla abierto**: si el contador no responde, deja pasar |

**`mcp-proxy.js`** — el proxy a Twelve Data / Alpha Vantage / Crypto.com.

Caducidades de la caché (`CADUCIDAD`, línea 25): precio 300 s · cripto 120 s ·
divisas 3.600 s · fundamentales 86.400 s · búsqueda de símbolo 604.800 s.

Un acierto que conviene no deshacer: **el cupo solo se gasta cuando hay fallo de
caché**. Si la respuesta sale de la caché va con `X-Cache: hit` y no cuesta nada.
Y los errores nunca se guardan en caché.

Variables de entorno en Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`TWELVE_DATA_KEY`, `ALPHA_VANTAGE_KEY`, `LIMITE_DIARIO`.
`APP_TOKEN` **ya no existe** y no debe volver: era la puerta vieja.

---

## 6 · La base de datos (`supabase/`)

Scripts que se pegan a mano en Supabase → SQL Editor. Los que ya están aplicados
en producción no hace falta volver a ejecutarlos.

| Fichero | Estado | Qué hace |
|---|---|---|
| `schema.sql` | aplicado | La tabla original `estado` (histórico) |
| `multiusuario.sql` | aplicado | `perfiles_estado`, `miembros`, RLS con `auth.uid()` |
| `invitaciones.sql` | aplicado | Códigos de invitación + `canjea_invitacion()` |
| `cache-y-limites.sql` | aplicado | `precios_cache`, `uso_diario`, `consume_peticion()` |
| `cerrar-puerta-vieja.sql` | aplicado | Renombró `estado` → `estado_copia_20260903` |
| `revision-seguridad.sql` | herramienta | Audita RLS, permisos, funciones. Se puede ejecutar cuando sea |
| `limpieza-total.sql` | a mano | Borra todas las cuentas. Paso 1 comprueba, paso 2 borra |
| `restaurar-mis-datos.sql` | a mano | Devuelve la cartera desde la copia de seguridad |
| `migrar-mis-datos.sql` | histórico | De `estado` a `perfiles_estado` |
| `plantillas-correo.md` | a mano | Los seis correos de Supabase, con marca propia |

### Las tablas

```
auth.users              (de Supabase)
public.perfiles_estado  user_id → json    · UNA fila por usuario, toda su app dentro
public.miembros         user_id           · quién tiene acceso
public.invitaciones     codigo, usos, tope, caduca
public.precios_cache    clave → valor     · RLS activo, CERO políticas: solo el backend
public.uso_diario       user_id, dia, n   · el cupo
public.estado_copia_20260903              · copia de seguridad, sin permisos
```

**Dos cosas que se han roto ya y volverán a romperse:**

1. **Los `grant` no son opcionales.** `bypassrls` del `service_role` no da
   permisos de tabla. Sin `grant ... to service_role` sale error `42501` *antes*
   de que RLS entre siquiera en juego. Cada tabla nueva necesita sus grants.
2. **Una función que devuelve `query` necesita `return;` detrás.** Sin él sigue
   ejecutando y devuelve dos filas. Nos pasó en `consume_peticion`.

Quitar a alguien de `miembros` le corta el acceso **sin borrarle los datos**. Las
políticas están escritas para eso.

---

## 7 · La documentación

| Fichero | Para qué |
|---|---|
| `README.md` | Qué es la aplicación y cómo se usa |
| `ARQUITECTURA.md` | Cómo está construida y por qué |
| `SEGURIDAD.md` | El modelo de seguridad y las pruebas pasadas |
| `DESPLIEGUE.md` | Cómo se sube cada pieza |
| `INVITACIONES.md` | Crear códigos, dar y quitar acceso, borrar una cuenta |
| `AVERIAS.md` | **Las averías que ya nos han costado tiempo.** Leerlo antes de pelearse con algo |
| `MAPA.md` | Esto |

---

## 8 · Lo que está a medias

- **El despliegue automático por FTP no funciona.** El workflow acaba en verde
  pero la cuenta FTP aterriza fuera del directorio del dominio: los ficheros se
  suben a un sitio que la web no sirve. Existe una cuenta FTP correcta
  (`u629583418.ahorrainvierteFTP`) creada pero sin probar. Mientras tanto, la
  subida del frontend es **manual**.
- **Etapa 6: segundo factor (TOTP)** — pendiente entera.
- **`GOOGM` debería ser `GOOGL`** en la posición de Alphabet.
- **Site URL de Supabase** seguía en `http://localhost:3000` de fábrica; por eso
  los enlaces de confirmación no aterrizaban bien.

---

*Al día 05/09/2026. Si cambias la estructura, actualiza este fichero — vale
justo lo que valga su exactitud.*

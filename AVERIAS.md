# Guía de averías

Fallos reales que aparecieron poniendo esto en producción, con sus síntomas
exactos y su solución. No son ejemplos inventados: los cuatro primeros
costaron una tarde entera entre todos.

**Lee esto antes que nada:** los cuatro se manifestaban **exactamente igual
desde fuera** — la aplicación abría, pedía la contraseña, y luego enseñaba
la portada con todo a €0,00 como si no hubiera nada guardado. Ninguno daba
un mensaje de error visible. La causa era distinta cada vez.

El motivo de ese silencio está en el código: el arranque de la app envuelve
la primera llamada al backend en un `try/catch` que se traga el error para
no asustar al usuario con una pantalla roja. Es una decisión defendible para
el uso diario y pésima para diagnosticar.

---

## Cómo diagnosticar, en vez de adivinar

La interfaz no te va a decir qué pasa. **Pregúntale al backend directamente.**

Abre la aplicación en el navegador, pulsa **F12** → pestaña **Console**, y
pega esto cambiando las dos primeras líneas por tus valores:

```js
const TOKEN = "tu-app-token";
const API   = "https://tu-proyecto.vercel.app";

// ¿Responde el guardado?
const r = await fetch(API + "/api/estado", {
  headers: { Authorization: "Bearer " + TOKEN }, cache: "no-store"
});
console.log(r.status, await r.text());
```

Y para los precios:

```js
const r2 = await fetch(API + "/api/mcp-proxy", {
  method: "POST",
  headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ servidor: "Twelve Data", herramienta: "get_price", entrada: { symbol: "AAPL" } })
});
console.log(r2.status, await r2.text());
```

Los nombres de servidor son literales y llevan espacios:
`"Twelve Data"`, `"Alpha Vantage MCP Server"`, `"Crypto.com"`.

**Interpretación rápida del resultado:**

| Lo que ves | Qué significa |
|---|---|
| `401 · needs_reauth` | El token no coincide con `APP_TOKEN` |
| `500 · APP_TOKEN no está configurado` | Falta la variable en Vercel |
| `502 · server_unavailable` | El backend está bien; falla Supabase o una API externa. Mira el `message` |
| `TypeError: Failed to fetch` sin código | **CORS**. La petición ni salió del navegador |
| `200` con datos | Esa pieza funciona |

Esa última fila del "Failed to fetch" es la más importante: un error de CORS
**no tiene código de estado**, porque el navegador descarta la respuesta
antes de dejarte verla. Si en la consola ves un mensaje rojo hablando de
*"Access-Control-Allow-Origin"*, ve directo a la avería nº 2.

---

## 1 · El despliegue de Vercel falla al construir

**Síntoma.** El deploy se pone en rojo. En los logs:

```
Error: Function Runtimes must have a valid version, for example 'now-php@1.0.0'
```

**Causa.** El `vercel.json` declara un runtime en el campo `functions` con
un formato que Vercel no acepta (por ejemplo `"runtime": "nodejs20.x"`).

**Solución.** No hace falta declarar nada: Vercel detecta las funciones de
`api/` solo. Deja el fichero así:

```json
{}
```

---

## 2 · La app abre, pide contraseña, y sale todo a cero

**El fallo estrella.** Aparenta ser "los conectores no funcionan", y no
tiene nada que ver con los conectores.

**Síntoma.** Todo carga bien, la contraseña se acepta, pero no hay datos y
"Actualizar ahora" no trae precios. En la consola del navegador (F12) hay
errores mencionando `Access-Control-Allow-Origin`, o peticiones que fallan
sin código de estado.

**Causa.** El dominio desde el que abres la aplicación no está en la lista
de `ALLOWED_ORIGIN` de Vercel. El navegador bloquea todas las llamadas
**antes de que salgan**, así que el backend ni se entera de que existes.

Pasa con mucha facilidad al cambiar de dominio, o mientras usas la dirección
temporal del hosting porque el dominio definitivo todavía está propagando.

**Cómo confirmarlo.** Desde la consola, con la app abierta:

```js
const r = await fetch("https://tu-proyecto.vercel.app/api/estado", {
  headers: { Authorization: "Bearer tu-token" }
});
console.log(r.headers.get("access-control-allow-origin"));
```

Si lo que imprime no coincide **exactamente** con el dominio de la barra de
direcciones (protocolo incluido), ese es el problema.

**Solución.** En Vercel → Environment Variables → `ALLOWED_ORIGIN`, lista
todos los dominios separados por comas, sin espacios:

```
https://tudominio.com,https://www.tudominio.com,https://temporal.hostingersite.com
```

Y **redespliega** (Deployments → ⋯ → Redeploy). Sin eso el cambio no entra.

> `https://tudominio.com` y `https://www.tudominio.com` son **orígenes
> distintos** para el navegador. Si no listas los dos, uno de ellos fallará.

---

## 3 · El backend responde `Failed to parse URL`

**Síntoma.**

```json
{"code":"server_unavailable",
 "message":"TypeError: Failed to parse URL from abcdefghijk/rest/v1/estado?..."}
```

**Causa.** En `SUPABASE_URL` está el **identificador** del proyecto en lugar
de su dirección. Se ve claro en el mensaje: falta el `https://` delante y el
`.supabase.co` detrás.

**Solución.** Poner la dirección completa y redesplegar:

```
https://abcdefghijk.supabase.co
```

---

## 4 · `permission denied for table estado` (código 42501)

**Síntoma.** El guardado devuelve 502 y, si tu `api/estado.js` reporta el
detalle, verás:

```json
{"code":"42501",
 "message":"permission denied for table estado",
 "hint":"Grant the required privileges to the current role with:
         GRANT SELECT, INSERT, UPDATE ON public.estado TO service_role;"}
```

**Causa.** La clave es correcta —Supabase reconoce al `service_role`— pero
ese rol no tiene privilegios sobre la tabla. Supabase cambió su
comportamiento: las tablas nuevas del esquema `public` **ya no heredan
automáticamente** los permisos de los roles del sistema.

Es especialmente confuso porque la tabla existe, se ve en el Table Editor, y
la clave es la buena. Todo parece correcto y aun así deniega.

**Solución.** En Supabase → SQL Editor → New query:

```sql
grant select, insert, update on public.estado to service_role;
```

No requiere redesplegar: es un cambio en la base de datos, tiene efecto
inmediato. El `schema.sql` de este repositorio ya incluye esta línea.

---

## 5 · Pide la contraseña una y otra vez

**Síntoma.** Escribes el `APP_TOKEN`, entras, y al poco te la vuelve a
pedir. Y otra vez.

**Causa.** El token no coincide con el de Vercel. La app acepta cualquier
texto que escribas y lo guarda, pero a la primera respuesta `401` lo borra —
y en la siguiente acción te lo pide de nuevo. El bucle no dice en ningún
momento "contraseña incorrecta".

**Solución.** Verifica el valor real. Ojo: si en Vercel guardaste la
variable como tipo **Secret**, ya no se puede volver a leer nunca. En ese
caso no intentes recordarla: pon un valor nuevo, redespliega, y borra el
viejo del navegador:

```js
localStorage.removeItem("cyc.token")
```

**Caso aparte, y normal:** que te pida **dos contraseñas distintas** al
entrar no es un fallo. La primera es la del directorio del hosting (ventana
gris del navegador, con usuario y contraseña); la segunda es el `APP_TOKEN`
de la aplicación. Son dos cerrojos independientes. Ver el paso 6 de
[`DESPLIEGUE.md`](./DESPLIEGUE.md).

---

## 6 · "Ningún producto tiene símbolo"

**Síntoma.** Pulsas **Actualizar ahora** en Precios y sale ese aviso, sin
traer ningún precio.

**Causa.** No es un fallo. La aplicación no puede pedir precios de productos
que no tienen ticker: "Apple" es un nombre, `AAPL` es un símbolo, y las APIs
solo entienden lo segundo.

**Solución.** En **Inversión → Precios**, escribe el ticker en la columna
**Símbolo** de cada producto. Si no lo sabes, el botón **Buscar por nombre**
de la ficha lo localiza.

---

## 7 · Alpha Vantage responde `rate_limited`

**Síntoma.** El tipo de cambio o algún dato no se actualiza, y el error
menciona *"Please consider spreading out your free API requests"*.

**Causa.** El plan gratuito de Alpha Vantage permite **una petición por
segundo y unas 25 al día**. No está roto: está esperando su turno.

**Solución.** Esperar. La app espacia las llamadas sola en uso normal; esto
solo aparece si pulsas "Actualizar ahora" repetidamente. Los precios de
acciones y ETF van por Twelve Data (800 al día), así que el límite de Alpha
Vantage apenas se nota.

---

## 8 · La web sigue igual después de subir cambios

**Síntoma.** Editas `frontend/index.html`, haces push, y en la web no
aparece nada nuevo.

**Causas posibles, en orden de probabilidad:**

1. **No hiciste `git add`.** `git commit` solo guarda lo que esté preparado.
   Si al hacer commit te dijo *"no changes added to commit"*, no se guardó
   nada y el push no envió nada. Comprueba con `git log --oneline` que tu
   commit está arriba del todo.
2. **El hosting no se entera de los push.** Vercel sí se redespliega solo,
   pero el frontend solo se sube automáticamente si configuraste los
   secretos FTP (paso 5 de `DESPLIEGUE.md`). Si no, hay que subir el
   `index.html` a mano cada vez.
3. **Caché del navegador.** Recarga con **Ctrl+F5**.

---

## 9 · Los datos no aparecen al cambiar de dominio

**Síntoma.** Estrenas dominio, entras, y la cartera está vacía aunque en el
dominio anterior tenías datos.

**Causa.** El almacenamiento local del navegador va **por dominio**. Lo que
guardaste en `viejo.com` no existe en `nuevo.com`, aunque sea la misma app.

**Solución.** Los datos que estén en Supabase sí se recuperan solos al
escribir el token. Si algo solo existía en local y lo quieres conservar,
antes de mudarte: F12 → Console en el dominio viejo →
`copy(localStorage.getItem("cyc.estado"))`, y pégalo donde puedas
recuperarlo.

---

## Si nada de esto encaja

Comprueba las piezas de abajo arriba, que es más rápido que ir probando:

1. **¿Vive el backend?** Abre `https://tu-proyecto.vercel.app/api/estado` en
   el navegador. Si contesta `needs_reauth`, está en pie.
2. **¿Pasa el token?** La llamada de la consola del principio de este
   documento. Si da 200 o 502 (no 401), el token es correcto.
3. **¿Responde Supabase?** Un 502 con `message` te dice literalmente qué
   pasa. Si el `message` viene vacío, actualiza `api/estado.js` a la versión
   de este repositorio, que reporta el detalle.
4. **¿Responden las APIs de mercado?** La segunda llamada de la consola.
5. **¿Y el CORS?** Repite la llamada **desde la propia web** (F12 estando en
   tu dominio), no desde otra pestaña. Si funciona en la consola de otro
   sitio pero no en tu web, es CORS seguro.

Los logs completos de cada llamada están en Vercel → tu proyecto →
**Logs**, con el error de servidor sin recortar.

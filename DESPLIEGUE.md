# Desplegar Inversio (Cuentas y Cartera) — GitHub + Vercel + Hostinger

Este documento da por hecho que ya tienes cuenta en las tres cosas. Sigue el
orden: cada paso necesita algo del anterior.

Reparto de responsabilidades, para que lo tengas claro antes de empezar:

| Pieza | Vive en | Por qué |
|---|---|---|
| El HTML de la app (`frontend/index.html`) | **Hostinger** | Es tu hosting de toda la vida, con tu dominio |
| Las funciones que llaman a las APIs de bolsa y guardan tus datos (`api/`) | **Vercel** | El hosting compartido de Hostinger no ejecuta Node.js; Vercel sí, y gratis |
| Tus datos (cartera, cuentas, etc.) | **Supabase** (Postgres) | Base de datos gratuita que Vercel puede leer y escribir |
| El código de las tres cosas | **GitHub** | Un solo repositorio; Vercel se redespliega solo al hacer push, y hay un workflow que sube el frontend a Hostinger solo |

---

## 0 · Antes de nada

Vas a necesitar tres claves gratuitas. Sácalas ya para no interrumpir el resto:

1. **Twelve Data**: [twelvedata.com](https://twelvedata.com) → crea cuenta → Dashboard → API Keys.
2. **Alpha Vantage**: [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) → un correo y listo.
3. Piensa una **contraseña larga y aleatoria** para la app (esto NO es la contraseña de ninguna cuenta, es un secreto que te inventas tú ahora — por ejemplo, 24 caracteres de un gestor de contraseñas). La vas a pegar en dos sitios: en Vercel como `APP_TOKEN`, y en la propia app la primera vez que la abras.

---

## 1 · GitHub — subir el proyecto

Los ficheros ya están preparados en `inversio/` (te los he mandado). En tu ordenador:

```bash
cd inversio
git init
git add .
git commit -m "Primer despliegue de Inversio"
```

Crea el repositorio en [github.com/new](https://github.com/new) (puede ser privado — recomendado, es tu cartera) y luego:

```bash
git remote add origin https://github.com/TU-USUARIO/inversio.git
git branch -M main
git push -u origin main
```

---

## 2 · Supabase — la base de datos

1. En [supabase.com](https://supabase.com), **New project**. Elige una región cercana (Europa) y una contraseña de base de datos (guárdala, no la necesitarás para esto pero sí si algún día quieres entrar por SQL directo).
2. Cuando el proyecto esté listo: **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` de este repositorio, y **Run**.
3. Ve a **Project Settings → API** y copia dos valores, los necesitas en el paso 3:
   - **Project URL** (`SUPABASE_URL`)
   - **service_role key**, la secreta, la que pone "keep this key secret" (`SUPABASE_SERVICE_KEY`). **Nunca** la `anon public key` — esa no sirve aquí porque las políticas de la tabla la bloquean a propósito.

---

## 3 · Vercel — el backend

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio `inversio` de GitHub.
2. En la configuración de importación dejas el **Root Directory** en la raíz del repo (no lo cambies): Vercel detecta solo la carpeta `api/` y despliega cada fichero como una función.
3. Antes de darle a Deploy, abre **Environment Variables** y añade estas cinco (los valores que ya tienes de los pasos 0 y 2):

   | Nombre | Valor |
   |---|---|
   | `APP_TOKEN` | la contraseña larga que te inventaste |
   | `TWELVE_DATA_KEY` | tu clave de Twelve Data |
   | `ALPHA_VANTAGE_KEY` | tu clave de Alpha Vantage |
   | `SUPABASE_URL` | del paso 2 |
   | `SUPABASE_SERVICE_KEY` | del paso 2 (la service_role) |

   `ALLOWED_ORIGIN` lo añades en el paso 5, cuando sepas la URL final de Hostinger — de momento puedes dejarlo sin crear, o ponerlo a `*` temporalmente para probar.

4. **Deploy**. Cuando acabe, Vercel te da una URL tipo `https://inversio-api-xxxx.vercel.app`. Cópiala, es tu `API_BASE`.

Cada vez que hagas `git push` con cambios en `api/`, Vercel vuelve a desplegar solo.

---

## 4 · Enlazar el frontend con el backend

Abre `frontend/index.html` (en tu copia local del repo) y busca, cerca del principio:

```html
<meta name="api-base" content="https://REEMPLAZA-ESTO.vercel.app">
```

Cambia esa URL por la que te dio Vercel en el paso 3 (sin barra al final). Guarda, haz commit y push:

```bash
git add frontend/index.html
git commit -m "Apunta el frontend al backend de Vercel"
git push
```

---

## 5 · Hostinger — publicar el frontend

**Primera vez, a mano** (luego ya lo automatizas):

1. hPanel → **Archivos → Administrador de archivos** → entra en `public_html` (o la subcarpeta de tu dominio).
2. Sube `frontend/index.html`. Si tu dominio ya tiene algo en `public_html`, súbelo a una subcarpeta, por ejemplo `public_html/inversio/`.
3. Abre la URL en el navegador y comprueba que carga (te va a pedir la contraseña, ver paso 6).

**Automatizarlo con GitHub** (recomendado, ya está el workflow escrito en `.github/workflows/deploy-frontend.yml`):

1. hPanel → **Archivos → Cuentas FTP** → crea una cuenta FTP (o usa la principal) y anota host, usuario y contraseña.
2. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**, crea `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` con esos datos.
3. Si vas a publicar en una subcarpeta, edita `server-dir` en el workflow (`./public_html/inversio/`).
4. A partir de ahora, cada `git push` que toque `frontend/` sube el fichero solo.

Por último, en Vercel añade la variable de entorno que faltaba:

| Nombre | Valor |
|---|---|
| `ALLOWED_ORIGIN` | `https://tudominio.com` (el dominio real donde quedó el frontend, con https, sin barra final) |

Y vuelve a desplegar en Vercel (Deployments → los tres puntos del último → Redeploy) para que la variable se aplique.

---

## 6 · Protección extra en Hostinger (muy recomendable)

El token de la API ya impide que nadie sin contraseña llame al backend. Pero el HTML en sí —sin datos, solo la aplicación vacía— quedaría visible para cualquiera que tenga la URL. Para cerrarlo del todo:

hPanel → **Sitio web → Protección con contraseña de directorios** → selecciona la carpeta donde subiste `index.html` → activa la protección → crea un usuario y contraseña (pueden ser distintos del `APP_TOKEN`).

Con esto, entrar a la URL pide primero esa contraseña (la del navegador, tipo "autenticación básica"), y luego, dentro ya, la app pide el `APP_TOKEN` para hablar con el backend. Dos cerrojos independientes.

---

## 7 · Comprobación final

1. Abre la URL de Hostinger. Te pedirá la contraseña del directorio (si activaste el paso 6) y luego la contraseña de la app: pega el mismo valor que pusiste en `APP_TOKEN` en Vercel.
2. Ve a **Inversión → Precios** y pulsa **Actualizar ahora**: si ves precios y no errores, Twelve Data/Alpha Vantage están bien conectados.
3. Cambia cualquier dato pequeño y espera al aviso "Guardado en tu cuenta". Recarga la página: si el cambio sigue ahí, Supabase está funcionando.
4. Abre la misma URL desde el móvil: te pedirá la contraseña otra vez (es un secreto por navegador, no por dispositivo) y deberías ver los mismos datos.

Si algo falla, la pestaña **Network** del navegador (F12) te dice si la petición fue a `/api/estado` o `/api/mcp-proxy` y qué código de error devolvió — dímelo y lo miro.

---

## 8 · Mantenimiento

- **Cuotas gratuitas**: Twelve Data 800 peticiones/día, Alpha Vantage ~25/día. Con una cartera de diez posiciones actualizando una vez al día vas sobrado.
- **Cambiar la contraseña de la app**: cambia `APP_TOKEN` en Vercel y vuelve a desplegar; la próxima vez que la app la pida, escribe la nueva.
- **Actualizar la app**: cualquier cambio futuro en el código se hace por `git push` — el backend se redespliega solo en Vercel, el frontend solo en Hostinger (con el workflow del paso 5).
- **Copia de seguridad de tus datos**: desde Supabase, Table Editor → tabla `estado` → exportar; o pídemelo y te preparo un botón de exportar dentro de la propia app.

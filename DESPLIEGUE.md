# Desplegar Cuentas y Cartera desde cero

Guía completa para montar la aplicación en tu propia infraestructura. Sigue
el orden: cada paso necesita algo del anterior.

Tiempo estimado: una hora larga la primera vez, contando la espera del DNS.

Reparto de responsabilidades, para tenerlo claro antes de empezar:

| Pieza | Vive en | Por qué ahí |
|---|---|---|
| El HTML de la app (`frontend/index.html`) | Tu hosting | Es un fichero estático; vale cualquier hosting, por barato que sea |
| Las funciones de precios y guardado (`api/`) | Vercel | Un hosting compartido no ejecuta Node.js; Vercel sí, y gratis |
| Tus datos | Supabase (Postgres) | Base de datos gratuita a la que Vercel accede por REST |
| El código | GitHub | Vercel se redespliega solo en cada push |

> **Nota sobre este documento.** Los avisos marcados con ⚠️ señalan puntos
> donde falló el despliegue real la primera vez. No son teóricos.

---

## 0 · Antes de empezar

Consigue estas tres cosas, que las vas a necesitar a mitad de camino:

1. **Clave de Twelve Data** — [twelvedata.com](https://twelvedata.com) →
   crear cuenta → Dashboard → API Keys. Es la fuente principal de precios de
   acciones y ETF.
2. **Clave de Alpha Vantage** —
   [alphavantage.co](https://www.alphavantage.co/support/#api-key). Solo pide
   un correo. Se usa como respaldo y para el tipo de cambio.
3. **Una contraseña larga y aleatoria inventada por ti.** Esto **no** es la
   contraseña de ninguna cuenta que ya tengas: es un secreto nuevo que te
   inventas ahora para esta aplicación. Unos 30 caracteres de un gestor de
   contraseñas. La vas a usar en dos sitios: como variable `APP_TOKEN` en
   Vercel, y escrita en la app la primera vez que la abras.

⚠️ **No reutilices aquí una credencial de otro servicio.** Este token se
escribe en un cuadro de diálogo del navegador, se guarda en `localStorage`
y viaja en cada petición. Es el sitio equivocado para una clave que sirva
para otra cosa.

---

## 1 · GitHub — subir el proyecto

Con el proyecto descargado en tu ordenador:

```bash
cd inversio
git init
git add .
git commit -m "Primer despliegue"
```

⚠️ Si `git commit` protesta con *"Author identity unknown"*, configura tu
identidad una sola vez y repite el commit:

```bash
git config --global user.email "tu@correo.com"
git config --global user.name "Tu Nombre"
```

Crea el repositorio en [github.com/new](https://github.com/new) —
**recomendado: privado**, que ahí va tu cartera— y **sin marcar ninguna
casilla de inicialización** (nada de README, .gitignore ni licencia: ya los
tienes). Después:

```bash
git remote add origin https://github.com/TU-USUARIO/inversio.git
git branch -M main
git push -u origin main
```

⚠️ **Tu usuario de GitHub no es el nombre que aparece en tu perfil.** El que
vale es el que sale en la URL de tu página: `github.com/ESTE-DE-AQUÍ`. Si el
push falla con *"repository not found"*, casi siempre es esto — o que el
repositorio todavía no está creado. Se corrige sin rehacer nada:

```bash
git remote set-url origin https://github.com/EL-BUENO/inversio.git
```

⚠️ Si al hacer `push` te sale *"src refspec main does not match any"*,
significa que **no hay ningún commit hecho todavía**. Comprueba con
`git log --oneline`: si dice "no commits yet", el commit del principio no
llegó a completarse. Recuerda que `git commit` solo guarda lo que hayas
pasado antes con `git add`.

---

## 2 · Supabase — la base de datos

1. En [supabase.com](https://supabase.com), **New project**. Elige región
   cercana y guarda la contraseña de base de datos que te pide (no la
   necesitarás para esto, pero sí si algún día entras por SQL directo).
2. Cuando el proyecto esté listo: **SQL Editor → New query**, pega el
   contenido de [`supabase/schema.sql`](./supabase/schema.sql) y pulsa
   **Run**. Debe responder *"Success. No rows returned"*.
3. Ve a **Project Settings** (el engranaje, abajo del todo) → **API Keys** y
   copia dos valores:
   - La **Project URL**, con este aspecto:
     `https://abcdefghijklm.supabase.co`
   - La **Secret key** (`sb_secret_…`). Si tu proyecto usa el sistema
     antiguo, estará en la pestaña **Legacy API keys** con el nombre
     `service_role` y será un texto larguísimo que empieza por `eyJ…`.

⚠️ **La Project URL no es el Project ID.** El identificador es solo
`abcdefghijklm`; lo que necesitas es la dirección completa, con `https://`
delante y `.supabase.co` detrás. Poner el identificador a secas provoca un
`TypeError: Failed to parse URL from …` que no dice en ningún sitio cuál es
el problema real.

⚠️ **La Publishable key (`sb_publishable_…`) no sirve aquí.** Es la clave
pública, y las políticas de la tabla la bloquean a propósito. Tiene que ser
la secreta.

---

## 3 · Vercel — el backend

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el
   repositorio `inversio` de GitHub.
2. Deja el **Root Directory** en la raíz del repo. Vercel detecta solo la
   carpeta `api/` y despliega cada fichero como una función.
3. Antes de pulsar Deploy, abre **Environment Variables** y añade estas
   cinco:

   | Nombre | Valor |
   |---|---|
   | `APP_TOKEN` | La contraseña larga que te inventaste en el paso 0 |
   | `TWELVE_DATA_KEY` | Tu clave de Twelve Data |
   | `ALPHA_VANTAGE_KEY` | Tu clave de Alpha Vantage |
   | `SUPABASE_URL` | La Project URL completa del paso 2 |
   | `SUPABASE_SERVICE_KEY` | La clave secreta del paso 2 |

   `ALLOWED_ORIGIN` se añade en el paso 5, cuando sepas el dominio final.

4. **Deploy**. Cuando termine, ve a la pestaña **Domains** del proyecto y
   copia el dominio estable, del tipo `https://inversio-xxxx.vercel.app`.
   Ese es tu `API_BASE`.

⚠️ **El dominio estable no es el del despliegue concreto.** Cada despliegue
genera además una URL larga y única que cambia cada vez. Usa la corta, la
que no cambia.

⚠️ **Abrir la raíz de esa URL devuelve un 404, y es lo correcto.** Este
proyecto no tiene ninguna página en `/`, solo funciones bajo `/api/`. Para
comprobar que vive, abre `https://tu-dominio.vercel.app/api/estado`: debe
contestar `{"code":"needs_reauth","message":"Token incorrecto o caducado."}`.
Ese 401 es la señal de que **todo va bien** — el backend está en pie y
rechazando a quien no se identifica.

Cada `git push` que toque `api/` redespliega solo.

---

## 4 · Enlazar el frontend con el backend

Abre `frontend/index.html` y busca, cerca del principio:

```html
<meta name="api-base" content="https://REEMPLAZA-ESTO.vercel.app">
```

Pon ahí la URL del paso 3, **sin barra al final**. Guarda y sube:

```bash
git add frontend/index.html
git commit -m "Apunta el frontend al backend"
git push
```

---

## 5 · El hosting del frontend

**La primera vez, a mano:**

1. En el panel de tu hosting, entra en el administrador de archivos y
   sitúate en `public_html` (o la carpeta de tu dominio).
2. Sube **`frontend/index.html`**.

⚠️ **Sube el fichero, no la carpeta.** Si arrastras la carpeta `frontend`
entera acabarás con `public_html/frontend/index.html`, y tu dominio no
enseñará nada. El fichero tiene que quedar directamente en
`public_html/index.html`.

**Automatizarlo después** (el workflow ya está escrito en
`.github/workflows/deploy-frontend.yml`):

1. En el panel del hosting, crea una cuenta FTP y anota servidor, usuario y
   contraseña.
2. En GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, y crea `FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD`.
3. A partir de ahí, cada push que toque `frontend/` sube el fichero solo.

**Y ahora, la variable que faltaba.** En Vercel → Environment Variables,
añade:

| Nombre | Valor |
|---|---|
| `ALLOWED_ORIGIN` | `https://tudominio.com` |

Admite **varios dominios separados por comas**, sin espacios. Conviene
listarlos todos:

```
https://tudominio.com,https://www.tudominio.com,https://loquesea.hostingersite.com
```

⚠️ **Este es el fallo más difícil de diagnosticar de toda la guía.** Si el
dominio desde el que abres la app no está en esa lista, el navegador bloquea
**todas** las llamadas al backend antes de que salgan, y la aplicación se
queda en blanco con todo a cero, sin ningún mensaje de error visible.
Incluye el dominio temporal de tu hosting mientras el definitivo propaga.

Después de tocar cualquier variable de entorno, **redespliega**:
Deployments → los tres puntos del último → **Redeploy**.

⚠️ **Cambiar una variable no afecta a lo que ya está corriendo.** Sin
redesplegar, el valor nuevo no entra en vigor. Este paso se olvida siempre.

---

## 6 · Protección adicional del hosting (opcional)

El `APP_TOKEN` ya impide que nadie sin la contraseña use el backend. El HTML
en sí —la aplicación vacía, sin ni un dato dentro— quedaría accesible para
quien conozca la URL. Si quieres taparlo también:

En el panel del hosting, busca **Proteger directorios con contraseña**
(en Hostinger está en **Avanzado**, no en Seguridad) y protege la carpeta
donde subiste el `index.html`.

Con esto tendrás **dos contraseñas**: la del navegador al entrar, y la de la
app al empezar a usarla. Es normal y son cerrojos distintos:

| | Qué protege | Qué pasa si falta |
|---|---|---|
| **Contraseña del directorio** | El fichero HTML | Un desconocido vería la app vacía, sin datos ni acceso a nada |
| **`APP_TOKEN`** | Tus datos y tus cuotas de API | Un desconocido podría leer tu cartera y gastarte las llamadas |

Si te molesta escribir dos, quita la del directorio y quédate con el token:
es la que protege algo que importa.

---

## 7 · Comprobación final

Por orden, y sin saltarse ninguna:

1. Abre tu dominio. Si activaste el paso 6, te pedirá la contraseña del
   directorio; después, la app te pedirá el `APP_TOKEN`.
2. Ve a **Inversión → Cartera** y crea un producto cualquiera. Ponle el
   ticker (`AAPL`, por ejemplo) en la columna **Símbolo** de la pestaña
   Precios.
3. En **Inversión → Precios**, pulsa **Actualizar ahora**. Si aparece un
   precio real, Twelve Data y Alpha Vantage están conectados.
4. Cambia cualquier dato y espera al aviso **"Guardado"**. Recarga la
   página: si el cambio sigue ahí, Supabase funciona.
5. Abre la misma dirección desde el móvil. Te pedirá la contraseña otra vez
   (se guarda por navegador, no por persona) y deberías ver los mismos
   datos.

Si algo falla, no adivines: ve a **[`AVERIAS.md`](./AVERIAS.md)**, que tiene
los fallos reales con sus síntomas exactos.

---

## 8 · Mantenimiento

- **Cambiar la contraseña de la app**: cambia `APP_TOKEN` en Vercel,
  redespliega, y borra la vieja del navegador (F12 → Console →
  `localStorage.removeItem("cyc.token")`).
- **Actualizar el código**: `git push`. El backend se redespliega solo; el
  frontend también, si activaste el FTP del paso 5.
- **Cambiar de dominio**: añade el nuevo a `ALLOWED_ORIGIN` (sin quitar el
  viejo hasta que el nuevo funcione), redespliega, y sube el `index.html` al
  hosting del dominio nuevo. Ojo: los datos guardados en el navegador **no
  viajan entre dominios**; los de Supabase sí.
- **Copia de seguridad**: Supabase → Table Editor → tabla `estado` →
  exportar. Es una sola fila con todo dentro.

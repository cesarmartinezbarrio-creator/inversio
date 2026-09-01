# Inversio — Cuentas y Cartera

App de finanzas personales e inversión a largo plazo. Antes vivía como
Artefacto de Claude; esta es la versión para desplegar por tu cuenta.

- `frontend/index.html` — la app entera, un solo fichero. Va a Hostinger.
- `api/` — funciones serverless (precios y guardado de estado). Van a Vercel.
- `supabase/schema.sql` — la tabla donde se guardan tus datos.
- `.github/workflows/deploy-frontend.yml` — sube `frontend/` a Hostinger por FTP en cada push.

**Para desplegarlo de cero, sigue [`DESPLIEGUE.md`](./DESPLIEGUE.md) paso a paso.**
No hay atajos: cada paso necesita algo del anterior (claves → base de datos → backend → frontend).

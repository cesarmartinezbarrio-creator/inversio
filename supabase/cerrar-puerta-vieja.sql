-- ═══════════════════════════════════════════════════════════════
-- ETAPA 4b · Cerrar la puerta vieja
-- ═══════════════════════════════════════════════════════════════
--
-- POR QUÉ. Hasta hoy había una contraseña única de la aplicación
-- (`APP_TOKEN`) que abría la tabla `estado` con toda la cartera dentro, sin
-- iniciar sesión y sin ser nadie en concreto. La aplicación ya no la usa,
-- pero mientras el token siga configurado en Vercel y la tabla exista, la
-- puerta sigue abierta: comprobado el 03/09/2026, una petición con ese
-- token devolvía la cartera entera.
--
-- Ese token, además, se ha escrito en conversaciones, se ha guardado en
-- navegadores y ha estado pegado en un panel de configuración. Hay que dar
-- por hecho que no es secreto.
--
-- ORDEN. Primero se comprueba que los datos están a salvo en el perfil;
-- solo entonces se borra lo viejo. No al revés.

-- ── Paso 1 · Comprobar antes de romper ─────────────────────────
-- Esto no borra nada: enseña lo que hay en cada sitio. Solo se sigue
-- adelante si el perfil tiene tus posiciones.

select
  (select jsonb_array_length(coalesce(json -> 'activos', '[]'::jsonb))
     from public.estado where id = 'principal')                  as posiciones_en_la_tabla_vieja,
  (select jsonb_array_length(coalesce(p.json -> 'activos', '[]'::jsonb))
     from public.perfiles_estado p
     join auth.users u on u.id = p.user_id
    where u.email = 'cesarmartinezbarrio@gmail.com')             as posiciones_en_tu_perfil,
  (select p.actualizado from public.perfiles_estado p
     join auth.users u on u.id = p.user_id
    where u.email = 'cesarmartinezbarrio@gmail.com')             as tu_perfil_actualizado;

-- ── Paso 2 · Una copia de seguridad, por si acaso ──────────────
-- La tabla vieja se conserva con otro nombre y sin permisos para nadie.
-- Ocupa unos kilobytes y quita el miedo. Cuando lleves un mes tranquilo,
-- la borras con:  drop table public.estado_copia_20260903;

alter table if exists public.estado rename to estado_copia_20260903;
alter table if exists public.estado_copia_20260903 enable row level security;
revoke all on public.estado_copia_20260903 from anon, authenticated;

-- Sin políticas y sin permisos: ni el backend con la clave de servicio la
-- toca por accidente. Para leerla, desde el editor SQL del panel y punto.

-- ── Paso 3 · Comprobación final ────────────────────────────────
select case when exists (select 1 from information_schema.tables
                          where table_schema='public' and table_name='estado')
            then 'REVISAR: la tabla estado sigue ahí'
            else 'bien: la puerta vieja está cerrada' end as resultado;

-- ── Paso 4 · Y esto NO es SQL: hay que hacerlo en Vercel ───────
--
--   1. Vercel → el proyecto → Settings → Environment Variables
--   2. Borrar la variable APP_TOKEN
--   3. Redeploy (Deployments → el último → ··· → Redeploy)
--
-- Sin esa variable, el backend deja de aceptar el token compartido y solo
-- responde a sesiones de verdad. Es el último cerrojo.
--
-- Y en el repositorio: borrar `api/estado.js`, que ya no lo usa nadie.

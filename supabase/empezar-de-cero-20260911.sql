-- ═══════════════════════════════════════════════════════════════
-- Empezar de cero · 11 de septiembre de 2026
-- ═══════════════════════════════════════════════════════════════
--
-- Borra TODAS las cuentas y sus datos, y crea SEIS códigos de
-- invitación nuevos y aleatorios.
--
-- Sustituye a `empezar-de-cero.sql` (07/09/2026), que generaba cinco
-- códigos y no comprobaba `intentos_invitacion`, tabla creada después.
--
-- Se ejecuta en Supabase → SQL Editor → New query.
-- Ctrl+A, Supr, y pegar. Ve por pasos, de arriba abajo.
--
-- ⚠️  ANTES DE EMPEZAR, comprueba una cosa (30 segundos):
--     Supabase → Authentication → Sign In / Providers
--     → "Allow new users to sign up" tiene que estar ACTIVADO.
--     Si está desactivado y borras las cuentas, te quedas fuera de tu
--     propia aplicación sin forma de volver a entrar desde la web.
--
-- EL ORDEN IMPORTA: los códigos se crean en el PASO 3, DESPUÉS del
-- borrado. Si los crearas antes, el PASO 1 se los llevaría por delante.


-- ── PASO 0 · Copia de seguridad (opcional) ─────────────────────
-- Dijiste que no te importa perder lo de este mes, así que puedes
-- saltarte este paso entero. Cuesta nada y es la única marcha atrás
-- que vas a tener. Para borrarla más adelante:
--   drop table public.copia_perfiles_20260911;

create table if not exists public.copia_perfiles_20260911 as
  select * from public.perfiles_estado;
alter table public.copia_perfiles_20260911 enable row level security;
revoke all on public.copia_perfiles_20260911 from anon, authenticated;

select count(*) as perfiles_copiados from public.copia_perfiles_20260911;


-- ── PASO 1 · Borrar las cuentas ────────────────────────────────
-- El `on delete cascade` arrastra con ellas: perfiles_estado,
-- miembros, uso_diario e intentos_invitacion.
-- Esto vacía a TODOS los usuarios, tú incluido. Es irreversible.

delete from auth.users;


-- ── PASO 2 · Vaciar la caché de precios ────────────────────────
-- No es de nadie y se rellena sola al usar la app, pero vieja estorba.

delete from public.precios_cache;


-- ── PASO 3 · SEIS códigos nuevos y aleatorios ──────────────────
-- Un solo uso cada uno, 30 días de caducidad.
-- El primero te sirve a ti para volver a registrarte; los otros cinco,
-- para invitar a quien quieras.

delete from public.invitaciones;

insert into public.invitaciones (codigo, nota, usos_max, caduca)
select 'INV-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
       'alta desde cero 11/09/2026', 1, now() + interval '30 days'
from generate_series(1, 6);

-- ⚠️  APÚNTATE ESTOS SEIS CÓDIGOS AHORA.
--     Están en claro en la tabla, pero si vuelves a ejecutar el script
--     los pierdes. Cópialos a un sitio seguro antes de seguir.

select codigo, caduca from public.invitaciones order by creado desc;


-- ── PASO 4 · Comprobación final ────────────────────────────────
-- Las cinco primeras cifras a CERO; la última, 6.
-- Si alguna de las cinco primeras no es cero, PARA y dímelo.

select
  (select count(*) from auth.users)                   as cuentas,
  (select count(*) from public.miembros)              as miembros,
  (select count(*) from public.perfiles_estado)       as perfiles,
  (select count(*) from public.uso_diario)            as contadores,
  (select count(*) from public.intentos_invitacion)   as intentos,
  (select count(*) from public.invitaciones)          as codigos_nuevos;


-- ── Y ahora, a empezar de cero ─────────────────────────────────
--
--   1. Entra en ahorrainvierte.es/acceso.html y regístrate de nuevo.
--   2. Confirma el correo.
--   3. Canjea uno de los códigos INV-… del PASO 3.
--   4. Empieza a crear tus ingresos, gastos e inversiones desde cero.
--
-- NO ejecutes `restaurar-mis-datos.sql`: traería de vuelta la cartera
-- vieja con sus categorías. Si algún día la quieres, la copia del
-- PASO 0 sigue ahí.
--
-- Si te atascas canjeando: la función frena tras 5 intentos fallidos
-- por hora. Para perdonarte el freno:
--   delete from public.intentos_invitacion;

-- ═══════════════════════════════════════════════════════════════
-- Empezar de cero · 7 de septiembre de 2026
-- ═══════════════════════════════════════════════════════════════
--
-- Borra TODAS las cuentas y sus datos, y crea códigos de invitación
-- nuevos ALEATORIOS (los viejos como CESAR-2026 se podían adivinar).
--
-- Lo ejecutas TÚ en Supabase: SQL Editor → New query. Ve por pasos, de
-- arriba abajo. Es irreversible, pero el PASO 0 deja una copia de todo
-- lo de hoy por si te arrepientes.
--
-- Cuando termines quedarás sin cuenta: tendrás que registrarte otra vez
-- en ahorrainvierte.es con uno de los códigos nuevos que salen en el
-- PASO 3. Empezarás en blanco, sin las categorías viejas (H1, H2,
-- Peluquería…): eso era justo lo que querías quitar.


-- ── PASO 0 · Copia de seguridad de HOY (red de seguridad) ──────
-- Guarda tu perfil actual en una tabla aparte, bajo llave. No la
-- restaurarás si de verdad quieres empezar vacío; está solo por si
-- cambias de idea. Cuando lleves un tiempo tranquilo, se borra con:
--   drop table public.copia_perfiles_20260907;

create table if not exists public.copia_perfiles_20260907 as
  select * from public.perfiles_estado;
alter table public.copia_perfiles_20260907 enable row level security;
revoke all on public.copia_perfiles_20260907 from anon, authenticated;

-- Comprueba que copió algo antes de seguir:
select count(*) as perfiles_copiados from public.copia_perfiles_20260907;


-- ── PASO 1 · Borrar las cuentas ────────────────────────────────
-- El `on delete cascade` se lleva con ellas perfiles_estado, miembros
-- y uso_diario. Esto vacía a TODOS los usuarios, tú incluido.

delete from auth.users;


-- ── PASO 2 · Vaciar la caché de precios ────────────────────────
-- No es de nadie, pero vieja estorba. Se rellena sola al usar la app.

delete from public.precios_cache;


-- ── PASO 3 · Códigos de invitación nuevos y ALEATORIOS ─────────
-- Fuera los viejos adivinables. Se crean cinco nuevos, de un solo uso
-- y con 30 días de caducidad. El primero que salga te sirve para
-- registrarte tú; los otros, para invitar a quien quieras.

delete from public.invitaciones;

insert into public.invitaciones (codigo, nota, usos_max, caduca)
select 'INV-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
       'alta desde cero', 1, now() + interval '30 days'
from generate_series(1, 5);

-- APÚNTATE ESTOS CÓDIGOS (no se pueden volver a ver en claro después):
select codigo, caduca from public.invitaciones order by creado desc;


-- ── PASO 4 · Comprobación final ────────────────────────────────
-- Las cuatro primeras cifras a cero; la última, 5.

select
  (select count(*) from auth.users)             as cuentas,
  (select count(*) from public.miembros)        as miembros,
  (select count(*) from public.perfiles_estado) as perfiles,
  (select count(*) from public.uso_diario)      as contadores,
  (select count(*) from public.invitaciones)    as codigos_nuevos;


-- ── Y ahora, a empezar de cero ─────────────────────────────────
--
--   1. Entra en ahorrainvierte.es/acceso.html y regístrate de nuevo.
--   2. Confirma el correo.
--   3. Entra y canjea uno de los códigos INV-… del PASO 3.
--   4. Empieza a crear tus ingresos, gastos e inversiones desde cero.
--
-- NO ejecutes restaurar-mis-datos.sql: eso traería de vuelta la cartera
-- vieja y sus categorías. Si algún día la quieres, ahí está la copia.
--
-- (Opcional) Como los códigos ya son aleatorios, cerrar el registro
-- abierto pasa a ser opcional. Si aun así lo quieres cerrar: Supabase →
-- Authentication → Sign In / Providers → desactivar "Allow new users to
-- sign up". Tendrías que dar de alta las cuentas tú desde el panel.

-- ═══════════════════════════════════════════════════════════════
-- Borrón y cuenta nueva · deja las cuentas a cero
-- ═══════════════════════════════════════════════════════════════
--
-- ⚠️ ESTO BORRA TODAS LAS CUENTAS, LA TUYA INCLUIDA. Y con ellas, por el
-- `on delete cascade`, sus perfiles y sus datos.
--
-- ANTES DE EJECUTARLO, LEE ESTO:
--
-- Tu cartera (las 8 posiciones) NO se pierde: sigue guardada en la tabla
-- `estado_copia_20260903`, la copia de seguridad que hicimos al cerrar la
-- puerta vieja. Después de volver a registrarte, se recupera con
-- `supabase/restaurar-mis-datos.sql`.
--
-- Si esa tabla no existiera, PARA: sin ella, este script sí te haría
-- perder la cartera. El paso 1 lo comprueba.

-- ── Paso 1 · ¿Está la copia de seguridad? ──────────────────────
-- Ejecuta SOLO esto primero. Tiene que decir "bien" y un número de
-- posiciones mayor que cero.

select
  case when exists (select 1 from information_schema.tables
                     where table_schema = 'public' and table_name = 'estado_copia_20260903')
       then 'bien: hay copia de seguridad'
       else 'PARA: no hay copia, no ejecutes el paso 2' end            as copia,
  (select jsonb_array_length(coalesce(json -> 'activos', '[]'::jsonb))
     from public.estado_copia_20260903 where id = 'principal')          as posiciones_guardadas;

-- ── Paso 2 · La limpieza ───────────────────────────────────────
-- Ejecuta esto solo si el paso 1 dijo "bien".

-- Las cuentas. El cascade se lleva perfiles_estado, miembros y uso_diario.
delete from auth.users;

-- Los códigos vuelven a estar sin usar.
update public.invitaciones set usos = 0;

-- La caché de precios, que no es de nadie pero estorba vieja.
delete from public.precios_cache;

-- ── Paso 3 · Comprobación ──────────────────────────────────────
-- Las cuatro cifras tienen que salir a cero.

select
  (select count(*) from auth.users)             as cuentas,
  (select count(*) from public.miembros)        as miembros,
  (select count(*) from public.perfiles_estado) as perfiles,
  (select count(*) from public.uso_diario)      as contadores;

-- ── Y ahora ────────────────────────────────────────────────────
--
--   1. Registrarte de nuevo en ahorrainvierte.es/acceso.html
--      con el código CESAR-2026, que vuelve a estar disponible.
--   2. Confirmar el correo.
--   3. Entrar y canjear el código.
--   4. Ejecutar `supabase/restaurar-mis-datos.sql` para recuperar
--      tu cartera. IMPORTANTE: hazlo antes de ponerte a meter datos
--      a mano, porque ese script no pisa nada que ya exista.

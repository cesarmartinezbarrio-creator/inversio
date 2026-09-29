-- ═══════════════════════════════════════════════════════════════
-- Vaciar MI cuenta · 29 de septiembre de 2026
-- ═══════════════════════════════════════════════════════════════
--
-- Deja la cuenta de cesarmartinezbarrio@gmail.com EN BLANCO, como recién
-- creada, SIN borrar el usuario ni la contraseña ni la membresía.
-- No toca a nadie más (la cuenta demo y cualquier otra quedan igual).
--
-- Se ejecuta en Supabase → SQL Editor → New query → pegar → Run.
-- Todo va en un único bloque: o se hace entero, o no se hace nada.
--
-- POR QUÉ NO SE BORRA LA FILA, SINO QUE SE SUSTITUYE:
--   La app guarda también una copia en cada navegador (PC y móvil). Si la
--   fila de la nube desapareciera, al abrir la app se cargaría esa copia
--   vieja y al primer cambio volvería a subirla: los datos resucitarían.
--   Por eso se deja un estado vacío con un número de revisión muy alto
--   (`rev`), que gana siempre a cualquier copia local antigua.

do $$
declare
  CORREO constant text := 'cesarmartinezbarrio@gmail.com';
  yo uuid;
  n int;
begin
  select id into yo from auth.users where lower(email) = lower(CORREO);
  if yo is null then
    raise exception 'No existe ninguna cuenta con el correo %', CORREO;
  end if;

  -- Estado vacío. La app rellena sola el resto (categorías de fábrica,
  -- mes actual…) y enseña la pantalla de primera configuración.
  insert into public.perfiles_estado (user_id, json, actualizado)
  values (yo, '{"apuntes":[],"aportaciones":[],"activos":[],"fijas":[],"rev":1000000}'::jsonb, now())
  on conflict (user_id) do update
    set json = excluded.json, actualizado = now();

  -- Contadores de uso de las APIs de mercado (no son datos tuyos, pero
  -- así el contador también arranca de cero).
  delete from public.uso_diario where user_id = yo;

  select count(*) into n from public.perfiles_estado
   where user_id = yo
     and jsonb_array_length(json->'apuntes') = 0
     and jsonb_array_length(json->'activos') = 0
     and jsonb_array_length(json->'aportaciones') = 0;
  if n <> 1 then
    raise exception 'La comprobación final no cuadra: no se ha cambiado nada';
  end if;

  raise notice 'Cuenta % vaciada. Usuario, contraseña y membresía intactos.', CORREO;
end $$;

-- Comprobación visible: 0 apuntes, 0 posiciones, 0 aportaciones.
select u.email,
       jsonb_array_length(p.json->'apuntes')      as apuntes,
       jsonb_array_length(p.json->'activos')      as posiciones,
       jsonb_array_length(p.json->'aportaciones') as aportaciones,
       (select count(*) from public.miembros m where m.user_id = u.id) as sigue_siendo_miembro
from auth.users u
join public.perfiles_estado p on p.user_id = u.id
where lower(u.email) = 'cesarmartinezbarrio@gmail.com';


-- ── OPCIONAL · Borrar también las copias viejas de septiembre ────
-- Los scripts de «empezar de cero» del 7 y del 11 de septiembre dejaron
-- copias de seguridad con tus datos antiguos. Si quieres que no quede
-- rastro, quita los dos guiones del principio de estas líneas y ejecútalas:
--
-- drop table if exists public.copia_perfiles_20260907;
-- drop table if exists public.copia_perfiles_20260911;

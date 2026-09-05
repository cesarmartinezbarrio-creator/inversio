-- ═══════════════════════════════════════════════════════════════
-- Recuperar la cartera después de volver a registrarse
-- ═══════════════════════════════════════════════════════════════
--
-- Copia la cartera guardada en `estado_copia_20260903` a tu perfil nuevo.
--
-- CUÁNDO: después de registrarte, confirmar el correo, entrar y canjear el
-- código. Antes de eso tu perfil no existe y esto no hace nada.
--
-- El `do nothing` del final es a propósito: si ya tienes datos en el
-- perfil, este script NO los pisa. Más vale no restaurar que machacar algo
-- que hayas escrito hoy.

insert into public.perfiles_estado (user_id, json)
select u.id, c.json
  from auth.users u
  cross join public.estado_copia_20260903 c
 where u.email = 'cesarmartinezbarrio@gmail.com'   -- ← cámbialo si te registras con otro
   and c.id = 'principal'
on conflict (user_id) do nothing;

-- Comprobación: cuántas posiciones y apuntes han llegado.
select u.email,
       jsonb_array_length(coalesce(p.json -> 'activos', '[]'::jsonb)) as posiciones,
       jsonb_array_length(coalesce(p.json -> 'apuntes', '[]'::jsonb)) as apuntes,
       p.actualizado
  from public.perfiles_estado p
  join auth.users u on u.id = p.user_id;

-- Si sale 0 posiciones, lo más probable es que el correo de arriba no sea
-- con el que te has registrado. Míralo con:
--   select email from auth.users;
-- y vuelve a ejecutar cambiando la dirección.

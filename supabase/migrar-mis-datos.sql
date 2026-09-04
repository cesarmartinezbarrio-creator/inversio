-- ═══════════════════════════════════════════════════════════════
-- ETAPA 3 · Llevar los datos de la tabla vieja a tu perfil
-- ═══════════════════════════════════════════════════════════════
--
-- Hasta ahora todo vivía en una única fila de `estado` (id = 'principal'),
-- sin dueño: quien tuviera el token la veía. A partir de ahora cada
-- persona tiene la suya en `perfiles_estado`, con su user_id, y las
-- políticas de PostgreSQL impiden que nadie vea la de otro.
--
-- Esto copia esa fila única a TU perfil. La vieja no se toca: se queda
-- ahí como copia de seguridad hasta que digamos lo contrario.
--
-- IMPORTANTE: ejecútalo ANTES de abrir la aplicación con el index.html
-- nuevo. Si la abres antes, se creará tu fila vacía y este script no la
-- pisará (usa `do nothing` a propósito, para no borrarte nada).

insert into public.perfiles_estado (user_id, json)
select u.id, e.json
  from auth.users u
  cross join public.estado e
 where u.email = 'cesarmartinezbarrio@gmail.com'
   and e.id = 'principal'
on conflict (user_id) do nothing;

-- Comprobación: cuántas posiciones y apuntes te han llegado.
select
  u.email,
  jsonb_array_length(coalesce(p.json -> 'activos', '[]'::jsonb)) as posiciones,
  jsonb_array_length(coalesce(p.json -> 'apuntes', '[]'::jsonb)) as apuntes,
  p.actualizado
from public.perfiles_estado p
join auth.users u on u.id = p.user_id;

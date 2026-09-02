-- ═══════════════════════════════════════════════════════════════
-- ETAPA 1 · Tabla de perfiles con aislamiento por usuario
-- ═══════════════════════════════════════════════════════════════
--
-- Se ejecuta una sola vez en Supabase: SQL Editor -> New query -> Run.
--
-- Convive con la tabla `estado` antigua: no la toca ni la borra, así que
-- la aplicación actual sigue funcionando igual mientras se hace la
-- migración. La vieja se elimina al final, en la etapa 4.
--
-- Todo el script es idempotente: se puede volver a ejecutar sin miedo.

-- ── La tabla ───────────────────────────────────────────────────
-- Una fila por usuario. La clave primaria ES el id del usuario, así que
-- por construcción no puede haber dos filas de la misma persona.
--
-- El `on delete cascade` no es un detalle: cuando se borra una cuenta,
-- sus datos se van con ella automáticamente. Es lo que exige el RGPD y
-- así no depende de que nadie se acuerde de hacerlo a mano.

create table if not exists public.perfiles_estado (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  json        jsonb       not null,
  actualizado timestamptz not null default now()
);

-- ── Row Level Security ─────────────────────────────────────────
-- Activarlo sin políticas significa "denegar a todo el mundo". Las
-- políticas de abajo abren exactamente lo imprescindible y nada más.

alter table public.perfiles_estado enable row level security;

-- ── Las políticas ──────────────────────────────────────────────
-- auth.uid() lo resuelve PostgreSQL leyendo el JWT de la petición. No
-- se lo pasa la aplicación, así que la aplicación no puede mentir.

drop policy if exists "leer solo lo propio" on public.perfiles_estado;
create policy "leer solo lo propio"
  on public.perfiles_estado for select
  to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "crear solo lo propio" on public.perfiles_estado;
create policy "crear solo lo propio"
  on public.perfiles_estado for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- Ojo a las DOS cláusulas de esta última:
--   using      -> qué filas puedes tocar (las tuyas)
--   with check -> en qué se pueden convertir (tienen que seguir siendo tuyas)
-- Sin el with_check, alguien podría actualizar su fila cambiándole el
-- user_id y regalársela a otro. Es un agujero clásico y silencioso.

drop policy if exists "actualizar solo lo propio" on public.perfiles_estado;
create policy "actualizar solo lo propio"
  on public.perfiles_estado for update
  to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- No se define ninguna política de DELETE: la aplicación nunca borra
-- esta fila. Al no existir, PostgreSQL deniega el borrado a todos.

-- ── Permisos de tabla ──────────────────────────────────────────
-- IMPRESCINDIBLE. Supabase ya no concede privilegios automáticamente a
-- los roles del sistema sobre las tablas nuevas del esquema public. Sin
-- esta línea, PostgreSQL rechaza con "42501: permission denied" ANTES de
-- llegar siquiera a evaluar las políticas de arriba, y el error no dice
-- nada sobre RLS, lo que despista muchísimo.
-- (Ver AVERIAS.md, avería nº 4: nos costó media tarde.)

grant select, insert, update on public.perfiles_estado to authenticated;

-- Deliberadamente NO se le concede nada al rol anon: quien no ha
-- iniciado sesión no tiene por qué tocar esta tabla ni para mirar.

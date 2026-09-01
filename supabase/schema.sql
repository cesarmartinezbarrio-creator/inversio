-- Ejecuta esto una vez en Supabase: Project -> SQL Editor -> New query -> Run.
-- Guarda un único estado (esta es una app de una sola persona): la fila
-- con id = 'principal' es la que la API lee y sobrescribe siempre.

create table if not exists estado (
  id text primary key,
  json jsonb not null,
  actualizado timestamptz not null default now()
);

-- Activamos RLS y no creamos ninguna política: así, aunque alguien
-- consiguiera la "anon key" (que nunca debe salir de aquí), no podría
-- leer ni escribir nada. Solo la "service_role key" que usa la función
-- de Vercel puede tocar esta tabla, porque esa clave salta el RLS.
alter table estado enable row level security;

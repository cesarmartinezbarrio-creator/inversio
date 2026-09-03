-- ═══════════════════════════════════════════════════════════════
-- ETAPA 5 · Caché de precios compartida y límite diario por usuario
-- ═══════════════════════════════════════════════════════════════
--
-- El problema que resuelve: las APIs de mercado tienen cuota diaria
-- (Twelve Data 800 peticiones/día, Alpha Vantage unas 25). Esa cuota es
-- de la aplicación entera, no de cada persona. Con un solo usuario daba
-- igual; con diez, el primero que abra la app por la mañana puede dejar
-- a los demás sin datos hasta el día siguiente.
--
-- Dos piezas, las dos en la base de datos porque tienen que ser comunes
-- a todo el mundo:
--
--   precios_cache -> si alguien ya preguntó el precio de AAPL hace tres
--                    minutos, el siguiente NO gasta una petición: lee la
--                    respuesta guardada. Diez personas con las mismas
--                    cinco acciones consumen lo mismo que una.
--   uso_diario    -> cuántas peticiones REALES (las que sí salen a
--                    internet) ha gastado cada uno hoy. Evita que una
--                    pestaña en bucle se lleve la cuota de todos.
--
-- Ninguna de las dos tablas se toca desde el navegador: solo las escribe
-- el backend con la clave de servicio. Idempotente: se puede repetir.

-- ── La caché ───────────────────────────────────────────────────
-- La clave es "servidor:herramienta:argumentos", por ejemplo
-- "Twelve Data:get_price:AAPL". El backend la construye; aquí solo se
-- guarda texto.
--
-- `vence` la calcula el backend según el tipo de dato: un precio caduca
-- en minutos, el balance de una empresa aguanta un día, y la búsqueda de
-- un símbolo, una semana. Guardar la fecha de caducidad (en vez de la de
-- creación) permite cambiar esos plazos sin invalidar lo ya guardado.

create table if not exists public.precios_cache (
  clave       text        primary key,
  payload     jsonb       not null,
  vence       timestamptz not null,
  actualizado timestamptz not null default now()
);

create index if not exists precios_cache_vence on public.precios_cache (vence);

-- RLS activado y CERO políticas = nadie desde el navegador, ni siquiera
-- para mirar. No es que los precios sean secretos: es que la caché es
-- infraestructura, y lo que nadie puede tocar nadie lo puede envenenar.
-- Si un usuario pudiera escribir aquí, podría hacer que TODOS los demás
-- vieran el precio que él quisiera.
alter table public.precios_cache enable row level security;

-- ── El contador de uso ─────────────────────────────────────────
-- Una fila por persona y día. El día se cuenta en UTC a propósito: es lo
-- mismo que usan las APIs para reiniciar su cuota, así que los dos
-- contadores se ponen a cero a la vez.

create table if not exists public.uso_diario (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  dia         date        not null default (now() at time zone 'utc')::date,
  peticiones  int         not null default 0,
  primary key (user_id, dia)
);

alter table public.uso_diario enable row level security;

-- Cada uno puede ver su propio gasto (para poder enseñarlo en la app:
-- "te quedan 240 consultas hoy"). Escribir, solo el backend.
drop policy if exists "ver mi propio uso" on public.uso_diario;
create policy "ver mi propio uso"
  on public.uso_diario for select
  to authenticated
  using ( (select auth.uid()) = user_id );

grant select on public.uso_diario to authenticated;

-- ── Consumir una petición ──────────────────────────────────────
-- Tiene que ser una función y no dos consultas sueltas: entre un "mira
-- cuántas lleva" y un "súmale una" caben otras peticiones de la misma
-- persona en otra pestaña, y el límite se lo salta por los pelos. Aquí
-- el insert...on conflict lo hace PostgreSQL de una sola vez.
--
-- Devuelve siempre las tres cifras, también cuando deniega, para que la
-- aplicación pueda decir algo útil en vez de un "no" a secas.

create or replace function public.consume_peticion(quien uuid, limite int)
returns table (permitido boolean, usadas int, limite_dia int)
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy    date := (now() at time zone 'utc')::date;
  nuevas int;
begin
  if quien is null then
    raise exception 'Falta el usuario';
  end if;

  insert into public.uso_diario (user_id, dia, peticiones)
  values (quien, hoy, 1)
  on conflict (user_id, dia) do update
    set peticiones = public.uso_diario.peticiones + 1
    where public.uso_diario.peticiones < limite
  returning public.uso_diario.peticiones into nuevas;

  if nuevas is null then
    -- El where de arriba no dejó actualizar: ya estaba en el límite.
    select u.peticiones into nuevas
      from public.uso_diario u
     where u.user_id = quien and u.dia = hoy;
    return query select false, coalesce(nuevas, limite), limite;
    return;   -- sin este return, la función seguiría y devolvería DOS filas
  end if;

  return query select true, nuevas, limite;
end;
$$;

-- Solo el backend. Un usuario con sesión NO puede llamarla: si pudiera,
-- podría gastarle la cuota a otro pasando su user_id.
revoke all on function public.consume_peticion(uuid, int) from public, anon, authenticated;

-- ── Permisos del backend ───────────────────────────────────────
-- El rol service_role tiene bypassrls, es decir se salta las POLÍTICAS,
-- pero eso no le da PERMISOS sobre la tabla: son dos cosas distintas y
-- PostgreSQL comprueba primero los permisos. Sin estas líneas el backend
-- recibe "42501: permission denied" y el mensaje no menciona RLS por
-- ningún sitio. Es exactamente la avería nº 4 de AVERIAS.md, la que nos
-- costó media tarde. No se borran.

grant select, insert, update, delete on public.precios_cache to service_role;
grant select, insert, update          on public.uso_diario    to service_role;
grant execute on function public.consume_peticion(uuid, int)  to service_role;

-- ── Limpieza ───────────────────────────────────────────────────
-- La caché crece poco (una fila por producto y tipo de dato) pero las
-- filas caducadas no sirven de nada. Esto se puede llamar de vez en
-- cuando desde el backend, o programarlo con pg_cron si algún día hace
-- falta. No es urgente: mil filas muertas no molestan a nadie.

create or replace function public.limpia_cache()
returns int
language sql
security definer
set search_path = public
as $$
  with borradas as (
    delete from public.precios_cache
     where vence < now() - interval '1 day'
    returning 1
  )
  select count(*)::int from borradas;
$$;

revoke all on function public.limpia_cache() from public, anon, authenticated;
grant execute on function public.limpia_cache() to service_role;

-- ── Cómo mirar cómo va la cosa ─────────────────────────────────
--
--   select clave, vence, actualizado from precios_cache order by actualizado desc limit 20;
--   select dia, count(*) as personas, sum(peticiones) as total
--     from uso_diario group by dia order by dia desc;
--
-- Y si un día hay que perdonarle el límite a alguien:
--   update uso_diario set peticiones = 0 where user_id = '...' and dia = current_date;

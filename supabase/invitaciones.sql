-- ═══════════════════════════════════════════════════════════════
-- ETAPA 2a · Registro por invitación
-- ═══════════════════════════════════════════════════════════════
--
-- Cualquiera puede crear una cuenta, pero sin canjear un código válido
-- no es miembro; y sin ser miembro, la base de datos no le deja ni crear
-- ni leer datos. El candado está en PostgreSQL, no en el navegador, así
-- que no se puede saltar tocando el código de la página.
--
-- Por qué no se valida en el momento del registro: en Supabase, las
-- cuentas creadas desde el panel y las que crea la gente sola entran por
-- la misma puerta. Un disparador que exigiera el código en el alta te
-- bloquearía también a ti creando usuarios a mano.
--
-- Idempotente: se puede volver a ejecutar sin miedo.

-- ── Quién puede usar la aplicación ─────────────────────────────

create table if not exists public.miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alta    timestamptz not null default now(),
  codigo  text
);

alter table public.miembros enable row level security;

-- Cada uno puede comprobar si él mismo es miembro, y nada más. No hay
-- política de INSERT: desde el navegador NADIE se puede dar de alta a sí
-- mismo. Eso solo lo hace la función de más abajo.
drop policy if exists "ver mi propia membresia" on public.miembros;
create policy "ver mi propia membresia"
  on public.miembros for select
  to authenticated
  using ( (select auth.uid()) = user_id );

grant select on public.miembros to authenticated;

-- ── Los códigos de invitación ──────────────────────────────────
-- RLS activado y CERO políticas: nadie desde el navegador puede leerlos,
-- ni siquiera para comprobar si uno existe. Solo se gestionan desde el
-- panel de Supabase y solo los lee la función de canje.

create table if not exists public.invitaciones (
  codigo   text primary key,
  nota     text,                                   -- "para mi hermana"
  usos_max int         not null default 1,
  usos     int         not null default 0,
  caduca   timestamptz,                            -- null = no caduca
  creado   timestamptz not null default now()
);

alter table public.invitaciones enable row level security;

-- ── La función de canje ────────────────────────────────────────
-- security definer: se ejecuta con los permisos del dueño de la función,
-- así que puede tocar `invitaciones` y `miembros` aunque quien la llama
-- no pueda. Es la única grieta, y es estrecha a propósito: solo hace una
-- cosa y comprueba todo antes.
--
-- El `set search_path` no es decorativo: sin él, alguien podría crear
-- tablas con estos nombres en otro esquema y engañar a la función.

create or replace function public.canjear_invitacion(codigo_txt text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  quien uuid := (select auth.uid());
  cod   text := upper(trim(coalesce(codigo_txt, '')));
  inv   public.invitaciones%rowtype;
begin
  if quien is null then
    raise exception 'Hay que iniciar sesión antes de canjear un código';
  end if;

  -- Si ya es miembro, no gasta un código nuevo ni da error.
  if exists (select 1 from public.miembros where user_id = quien) then
    return 'ya-era-miembro';
  end if;

  if cod = '' then
    raise exception 'Escribe el código de invitación';
  end if;

  -- for update bloquea la fila: si dos personas canjean el mismo código
  -- a la vez, una espera a la otra y el contador no se descuadra.
  select * into inv from public.invitaciones where codigo = cod for update;

  if not found then
    raise exception 'Ese código no es válido';
  end if;
  if inv.caduca is not null and inv.caduca < now() then
    raise exception 'Ese código ha caducado';
  end if;
  if inv.usos >= inv.usos_max then
    raise exception 'Ese código ya se ha usado';
  end if;

  insert into public.miembros (user_id, codigo) values (quien, cod);
  update public.invitaciones set usos = usos + 1 where codigo = cod;

  return 'alta-correcta';
end;
$$;

-- Solo alguien con sesión iniciada puede intentar canjear. Un anónimo ni
-- siquiera puede llamar a la función para ir probando códigos.
revoke all on function public.canjear_invitacion(text) from public, anon;
grant execute on function public.canjear_invitacion(text) to authenticated;

-- ── Las políticas de datos, ahora exigiendo membresía ──────────
-- Se reemplazan las de la etapa 1 añadiéndoles la condición de ser
-- miembro. Gatear también la lectura permite RETIRAR el acceso a alguien
-- borrándolo de `miembros`: sus datos siguen ahí pero deja de verlos.

drop policy if exists "leer solo lo propio" on public.perfiles_estado;
create policy "leer solo lo propio"
  on public.perfiles_estado for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.miembros m where m.user_id = (select auth.uid()))
  );

drop policy if exists "crear solo lo propio" on public.perfiles_estado;
create policy "crear solo lo propio"
  on public.perfiles_estado for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.miembros m where m.user_id = (select auth.uid()))
  );

drop policy if exists "actualizar solo lo propio" on public.perfiles_estado;
create policy "actualizar solo lo propio"
  on public.perfiles_estado for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.miembros m where m.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.miembros m where m.user_id = (select auth.uid()))
  );

-- ── Cómo crear códigos (esto se ejecuta cuando quieras invitar) ─
--
--   insert into invitaciones (codigo, nota) values ('FAMILIA-2026', 'mi hermana');
--   insert into invitaciones (codigo, nota, usos_max, caduca)
--     values ('AMIGOS-OCT', 'los del grupo', 5, now() + interval '30 days');
--
-- Y para ver cómo van:
--   select codigo, nota, usos, usos_max, caduca from invitaciones order by creado desc;
--
-- Para retirarle el acceso a alguien:
--   delete from miembros where user_id = '...';

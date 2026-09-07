-- ═══════════════════════════════════════════════════════════════
-- Freno a la fuerza bruta de códigos de invitación
-- ═══════════════════════════════════════════════════════════════
--
-- Con los códigos ya aleatorios (INV-XXXXXXXX) adivinarlos es inviable,
-- pero esto pone un cinturón más: cada usuario solo puede fallar unos
-- cuantos códigos por hora; pasado ese tope, se le frena.
--
-- Detalle técnico importante: la función NO usa `raise` para los fallos
-- de negocio (código inválido, caducado…). Si lo hiciera, PostgreSQL
-- revertiría la transacción entera y con ella el propio contador de
-- intentos, que es justo lo que queremos conservar. En su lugar devuelve
-- un ESTADO en texto y es la aplicación quien lo traduce a un mensaje.
--
-- Idempotente: se puede volver a ejecutar sin miedo.

-- ── El contador de intentos, uno por usuario ───────────────────
-- RLS activado y sin políticas ni grants: solo la función de abajo, que
-- corre como su dueño (security definer), la toca. Desde el navegador,
-- nadie la ve ni la escribe.
create table if not exists public.intentos_invitacion (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  intentos int         not null default 0,
  desde    timestamptz not null default now()
);
alter table public.intentos_invitacion enable row level security;

-- ── La función de canje, ahora con freno ───────────────────────
create or replace function public.canjear_invitacion(codigo_txt text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  quien  uuid := (select auth.uid());
  cod    text := upper(trim(coalesce(codigo_txt, '')));
  inv    public.invitaciones%rowtype;
  ints   int;
  desde_ timestamptz;
  MAXI   constant int      := 5;              -- intentos fallidos por ventana
  VENT   constant interval := interval '1 hour';
begin
  if quien is null then return 'sin-sesion'; end if;

  -- Si ya es miembro, no gasta código ni cuenta como intento.
  if exists (select 1 from public.miembros where user_id = quien) then
    return 'ya-era-miembro';
  end if;

  -- ¿Cuántos lleva fallados en la última hora? Si la ventana caducó, se
  -- reinicia el contador.
  select intentos, desde into ints, desde_
    from public.intentos_invitacion where user_id = quien;
  if desde_ is null or desde_ < now() - VENT then
    insert into public.intentos_invitacion (user_id, intentos, desde)
      values (quien, 0, now())
      on conflict (user_id) do update set intentos = 0, desde = now();
    ints := 0;
  end if;
  if ints >= MAXI then
    return 'frenado';
  end if;

  if cod = '' then
    return 'vacio';
  end if;

  -- for update bloquea la fila: dos canjes simultáneos del mismo código
  -- se ordenan y el contador de usos no se descuadra.
  select * into inv from public.invitaciones where codigo = cod for update;

  if not found then
    update public.intentos_invitacion set intentos = intentos + 1 where user_id = quien;
    return 'invalido';
  end if;
  if inv.caduca is not null and inv.caduca < now() then
    update public.intentos_invitacion set intentos = intentos + 1 where user_id = quien;
    return 'caducado';
  end if;
  if inv.usos >= inv.usos_max then
    update public.intentos_invitacion set intentos = intentos + 1 where user_id = quien;
    return 'usado';
  end if;

  -- Acierto: alta y limpieza del contador.
  insert into public.miembros (user_id, codigo) values (quien, cod);
  update public.invitaciones set usos = usos + 1 where codigo = cod;
  delete from public.intentos_invitacion where user_id = quien;
  return 'alta-correcta';
end;
$$;

-- Solo alguien con sesión puede intentar canjear.
revoke all on function public.canjear_invitacion(text) from public, anon;
grant execute on function public.canjear_invitacion(text) to authenticated;

-- Para perdonarle el freno a alguien que se atascó de buena fe:
--   delete from public.intentos_invitacion where user_id = '...';

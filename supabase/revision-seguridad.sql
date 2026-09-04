-- ═══════════════════════════════════════════════════════════════
-- Revisión de seguridad · se ejecuta cuando se quiera, no cambia nada
-- ═══════════════════════════════════════════════════════════════
--
-- Comprueba de una tacada lo que de verdad protege los datos. Todo lo que
-- salga como "REVISAR" merece una mirada; lo que salga "bien", está bien.
-- No modifica nada: son solo consultas.

-- ── 1. ¿Tienen todas las tablas el candado echado? ─────────────
select
  c.relname                                   as tabla,
  case when c.relrowsecurity then 'bien' else 'REVISAR: sin RLS' end as estado,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- ── 2. ¿Quién puede tocar cada tabla? ──────────────────────────
-- anon no debería aparecer NUNCA en esta lista.
select table_name as tabla, grantee as rol,
       string_agg(privilege_type, ', ' order by privilege_type) as permisos,
       case when grantee = 'anon' then 'REVISAR: anon no debería tener permisos' else 'bien' end as estado
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
group by table_name, grantee
order by table_name, grantee;

-- ── 3. Funciones con permisos de dueño (security definer) ──────
-- Son la única grieta por diseño. Deben ser pocas, y todas con
-- search_path fijado: sin él se las puede engañar creando tablas con el
-- mismo nombre en otro esquema.
select p.proname as funcion,
       case when p.prosecdef then 'security definer' else 'normal' end as tipo,
       case when p.prosecdef and (p.proconfig is null
              or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
            then 'REVISAR: sin search_path fijado' else 'bien' end as estado,
       coalesce(array_to_string(p.proconfig, ', '), '') as ajustes
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.prosecdef desc, p.proname;

-- ── 4. ¿Quién puede ejecutar cada función? ─────────────────────
select p.proname as funcion,
       coalesce(array_to_string(p.proacl, ' | '), 'permisos por defecto (REVISAR)') as quien_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- ── 5. Cuentas y actividad ─────────────────────────────────────
select
  (select count(*) from auth.users)                                   as cuentas,
  (select count(*) from public.miembros)                              as con_acceso,
  (select count(*) from auth.users u
     where not exists (select 1 from public.miembros m where m.user_id = u.id)) as sin_canjear,
  (select count(*) from public.perfiles_estado)                       as perfiles_con_datos;
-- (Para ver quién no ha confirmado el correo, cuando la confirmación esté
--  activada:  select email from auth.users where email_confirmed_at is null; )

-- ── 6. La tabla vieja: ¿sigue ahí? ─────────────────────────────
-- Mientras exista y el APP_TOKEN siga configurado en Vercel, hay una
-- puerta trasera abierta: quien tenga ese token lee la cartera entera
-- sin iniciar sesión. Cuando la migración esté confirmada, se cierra
-- con `supabase/cerrar-puerta-vieja.sql`.
select case when exists (select 1 from information_schema.tables
                          where table_schema='public' and table_name='estado')
            then 'REVISAR: la tabla estado sigue existiendo'
            else 'bien: la puerta vieja está cerrada' end as puerta_vieja;

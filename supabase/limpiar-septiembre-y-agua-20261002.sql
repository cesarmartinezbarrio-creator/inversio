-- ═══════════════════════════════════════════════════════════════
-- Limpiar MI cuenta · 2 de octubre de 2026
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas, solo en la cuenta de cesarmartinezbarrio@gmail.com:
--   1. Borra los apuntes de Mi economía de SEPTIEMBRE de 2026 (eran de
--      prueba: la app se empieza a usar en octubre).
--   2. Quita la partida fija «Agua», que está repetida con «Agua y
--      basuras»: su etiqueta, su chincheta y su importe previsto.
--
-- OCTUBRE NO SE TOCA. Si «Agua» tuviera algún apunte de octubre en
-- adelante, el paso 3 se para con un error y no cambia NADA: ese dinero
-- habría que pasarlo a mano a «Agua y basuras» antes.
--
-- Las aportaciones a inversiones NO se tocan (la consulta del paso 1 dice
-- si hay alguna en septiembre, por si acaso).
--
-- CÓMO: cierra la app en el PC y en el móvil. Luego, en Supabase → SQL
-- Editor → New query, pega y ejecuta CADA PASO POR SEPARADO, en orden.
--
-- POR QUÉ SE SUBE `rev`: la app guarda también una copia en cada
-- navegador, y al abrir se queda con la de número de revisión más alto.
-- Subiéndolo, gana esta versión limpia y la copia vieja no resucita.


-- ── PASO 1 · MIRAR (solo lee, no cambia nada) ──────────────────
-- Cuántos apuntes hay por mes, sección y partida.
select a->>'mes' as mes, a->>'seccion' as seccion, a->>'item' as partida,
       count(*) as apuntes, round(sum((a->>'importe')::numeric), 2) as total
  from public.perfiles_estado p
  join auth.users u on u.id = p.user_id
  cross join jsonb_array_elements(coalesce(p.json->'apuntes', '[]'::jsonb)) a
 where lower(u.email) = 'cesarmartinezbarrio@gmail.com'
 group by 1, 2, 3
 order by 1, 2, 3;

-- Tus etiquetas, chinchetas, importes previstos, aportaciones de
-- septiembre y la revisión actual.
select p.json->'etiquetas'    as etiquetas,
       p.json->'fijas'        as chinchetas,
       p.json->'presupuestos' as previstos,
       (select count(*) from jsonb_array_elements(coalesce(p.json->'aportaciones', '[]'::jsonb)) x
         where x->>'mes' = '2026-09') as aportaciones_septiembre,
       p.json->'rev'          as rev
  from public.perfiles_estado p
  join auth.users u on u.id = p.user_id
 where lower(u.email) = 'cesarmartinezbarrio@gmail.com';


-- ── PASO 2 · COPIA DE SEGURIDAD ───────────────────────────────
-- Guarda tu estado tal cual está ahora. Si algo sale mal, se puede volver.
create table if not exists public.perfiles_estado_copia_20261002 as
select p.* from public.perfiles_estado p
  join auth.users u on u.id = p.user_id
 where lower(u.email) = 'cesarmartinezbarrio@gmail.com';
-- Candado: sin esto, la copia se podría leer con la clave pública de la
-- página. Con RLS activo y sin políticas, solo la ve el SQL Editor.
alter table public.perfiles_estado_copia_20261002 enable row level security;
revoke all on public.perfiles_estado_copia_20261002 from anon, authenticated;


-- ── PASO 3 · HACER LA LIMPIEZA ────────────────────────────────
-- Todo en un bloque: o se hace entero, o no se hace nada.
do $$
declare
  CORREO constant text := 'cesarmartinezbarrio@gmail.com';
  yo uuid;
  j jsonb;
  agua_oct int;
  borrados int;
  es_agua constant text := '^\s*agua\s*$';
begin
  select id into yo from auth.users where lower(email) = lower(CORREO);
  if yo is null then raise exception 'No existe ninguna cuenta con el correo %', CORREO; end if;
  if not exists (select 1 from public.perfiles_estado_copia_20261002 where user_id = yo) then
    raise exception 'Falta la copia de seguridad: ejecuta antes el PASO 2.';
  end if;

  select json into j from public.perfiles_estado where user_id = yo for update;
  if j is null then raise exception 'Tu cuenta no tiene datos guardados.'; end if;

  -- Octubre no se toca: si «Agua» tiene dinero de octubre en adelante, parar.
  select count(*) into agua_oct
    from jsonb_array_elements(coalesce(j->'apuntes', '[]'::jsonb)) a
   where a->>'seccion' = 'fijos' and lower(a->>'item') ~ es_agua and a->>'mes' >= '2026-10';
  if agua_oct > 0 then
    raise exception '«Agua» tiene % apunte(s) de octubre o después. No se ha cambiado nada.', agua_oct;
  end if;

  -- 1 · Fuera los apuntes de septiembre de 2026
  select count(*) into borrados
    from jsonb_array_elements(coalesce(j->'apuntes', '[]'::jsonb)) a
   where a->>'mes' = '2026-09';
  j := jsonb_set(j, '{apuntes}', coalesce((
         select jsonb_agg(a) from jsonb_array_elements(coalesce(j->'apuntes', '[]'::jsonb)) a
          where a->>'mes' is distinct from '2026-09'), '[]'::jsonb));

  -- 2 · Fuera «Agua»: etiqueta, chincheta e importe previsto
  if j ? 'etiquetas' and jsonb_typeof(j->'etiquetas'->'fijos') = 'array' then
    j := jsonb_set(j, '{etiquetas,fijos}', coalesce((
           select jsonb_agg(t) from jsonb_array_elements(j->'etiquetas'->'fijos') t
            where lower(t #>> '{}') !~ es_agua), '[]'::jsonb));
  end if;
  j := jsonb_set(j, '{fijas}', coalesce((
         select jsonb_agg(f) from jsonb_array_elements(coalesce(j->'fijas', '[]'::jsonb)) f
          where not (f->>'seccion' = 'fijos' and lower(f->>'item') ~ es_agua)), '[]'::jsonb));
  if jsonb_typeof(j->'presupuestos') = 'object' then
    j := jsonb_set(j, '{presupuestos}', coalesce((
           select jsonb_object_agg(k, v) from jsonb_each(j->'presupuestos') e(k, v)
            where lower(k) !~ '^fijos\|\s*agua\s*$'), '{}'::jsonb));
  end if;

  -- 3 · Que esta versión gane a las copias de los navegadores
  j := jsonb_set(j, '{rev}', to_jsonb(coalesce((j->>'rev')::numeric, 0) + 1000));

  update public.perfiles_estado set json = j, actualizado = now() where user_id = yo;
  raise notice 'Hecho: % apunte(s) de septiembre borrados y «Agua» quitada.', borrados;
end $$;


-- ── SI ALGO SALE MAL · VOLVER A COMO ESTABA ───────────────────
-- (No lo ejecutes si todo ha ido bien.)
-- update public.perfiles_estado p
--    set json = jsonb_set(c.json, '{rev}', to_jsonb(coalesce((p.json->>'rev')::numeric, 0) + 1000)),
--        actualizado = now()
--   from public.perfiles_estado_copia_20261002 c
--  where c.user_id = p.user_id;

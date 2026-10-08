-- ============================================================================
-- LX Ventas · 009 · Ranking de la UGEL para el asesor
-- El asesor solo ve sus propias ventas. Esta función le devuelve, sin mostrar
-- ventas ajenas, cuántas ventas válidas lleva cada asesor de su misma zona.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se puede correr
-- más de una vez.
-- ============================================================================
create or replace function public.ranking_zona(p_desde date, p_hasta date)
returns table (asesor_id uuid, nombre text, validas integer, es_yo boolean)
language sql
stable
security definer
set search_path = public
as $ranking$
  with yo as (
    select id, empresa_id, zona_id
    from public.perfiles
    where usuario_id = auth.uid() and activo
  ),
  cfg as (
    select translate(upper(c.condicion_valida), 'ÁÉÍÓÚ', 'AEIOU') as condicion,
           translate(upper(c.pago_valido), 'ÁÉÍÓÚ', 'AEIOU') as pago
    from public.configuracion c
    join yo on yo.empresa_id = c.empresa_id
  )
  select p.id,
         p.nombre,
         (
           select count(*)::integer
           from public.ventas v, cfg
           where v.asesor_id = p.id
             and v.empresa_id = yo.empresa_id
             and v.fecha between p_desde and p_hasta
             and v.estado <> 'caida'
             and v.cuota_estado = 'confirmada'
             and translate(upper(coalesce(v.condicion, '')), 'ÁÉÍÓÚ', 'AEIOU') like '%' || cfg.condicion || '%'
             and translate(upper(coalesce(v.pago, '')), 'ÁÉÍÓÚ', 'AEIOU') like '%' || cfg.pago || '%'
         ),
         p.id = yo.id
  from public.perfiles p
  join yo on p.empresa_id = yo.empresa_id
  where p.rol = 'asesor'
    and p.activo
    and yo.zona_id is not null
    and p.zona_id = yo.zona_id;
$ranking$;

revoke all on function public.ranking_zona(date, date) from public, anon;
grant execute on function public.ranking_zona(date, date) to authenticated;

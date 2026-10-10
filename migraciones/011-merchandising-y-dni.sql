-- ============================================================================
-- LX Ventas · 011 · Entrega de merchandising y DNI del personal
-- - entregas: lo que el asesor entrega a cada docente (producto y cantidad),
--   para el formato "Control de entrega merchandising".
-- - perfiles.dni: DNI del asesor, para el formato "Planilla del asesor".
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se puede correr
-- más de una vez.
-- ============================================================================
alter table public.perfiles
  add column if not exists dni text;

create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  zona_id uuid references public.zonas(id),
  asesor_id uuid not null references public.perfiles(id),
  prospecto_id uuid references public.prospectos(id) on delete set null,
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  hora text,
  nombre text not null,
  celular text,
  lugar text,
  producto text not null,
  cantidad integer not null default 1 check (cantidad > 0),
  observacion text,
  idem_key text not null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, idem_key)
);

create index if not exists entregas_empresa_fecha on public.entregas (empresa_id, fecha);

drop trigger if exists sellar_entregas on public.entregas;
create trigger sellar_entregas before insert on public.entregas
  for each row execute function public.sellar_registro();

alter table public.entregas enable row level security;

drop policy if exists entregas_ver on public.entregas;
create policy entregas_ver on public.entregas for select to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or (public.mi_rol() <> 'asesor' and public.veo_zona(zona_id))));

drop policy if exists entregas_crear on public.entregas;
create policy entregas_crear on public.entregas for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() <> 'gerencia');

drop policy if exists entregas_editar on public.entregas;
create policy entregas_editar on public.entregas for update to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'))
  with check (empresa_id = public.mi_empresa());

drop policy if exists entregas_borrar on public.entregas;
create policy entregas_borrar on public.entregas for delete to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'));

grant select, insert, update, delete on public.entregas to authenticated;

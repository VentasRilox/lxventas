-- ============================================================================
-- LX Ventas · 003 · Jornada (ingreso y salida) y primera mensualidad
-- 1) El asesor marca su ingreso y su salida del día, con hora y ubicación.
-- 2) Cada venta lleva el estado de su primera mensualidad: pendiente,
--    reportada (el asesor dice que ya se pagó) o confirmada (el supervisor o
--    el jefe la verificó). Solo la confirmada cuenta como venta válida.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- ============================================================================
begin;

-- ---------- Ajustes de la empresa -------------------------------------------
alter table public.configuracion
  add column primera_cuota_centimos integer not null default 13000 check (primera_cuota_centimos >= 0),
  add column hora_tolerancia text not null default '08:15',
  add column dias_alerta_cuota integer not null default 3 check (dias_alerta_cuota >= 0);

-- ---------- Jornada ----------------------------------------------------------
create table public.asistencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  zona_id uuid references public.zonas(id),
  asesor_id uuid not null references public.perfiles(id),
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  hora_ingreso text,
  lat_ingreso double precision,
  lng_ingreso double precision,
  hora_salida text,
  lat_salida double precision,
  lng_salida double precision,
  salida_en timestamptz,
  idem_key text not null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, idem_key)
);

create index asistencias_empresa_fecha on public.asistencias (empresa_id, fecha);

create trigger sellar_asistencias before insert on public.asistencias
  for each row execute function public.sellar_registro();

-- Lo ya marcado no se cambia: ni el ingreso ni la salida. Solo el jefe corrige.
create function public.proteger_asistencia() returns trigger
language plpgsql security definer set search_path = public as $protasis$
begin
  if public.mi_rol() is null or public.mi_rol() = 'jefe' then
    return new;
  end if;
  new.empresa_id := old.empresa_id;
  new.asesor_id := old.asesor_id;
  new.zona_id := old.zona_id;
  new.fecha := old.fecha;
  new.idem_key := old.idem_key;
  new.creado_en := old.creado_en;
  if old.hora_ingreso is not null then
    new.hora_ingreso := old.hora_ingreso;
    new.lat_ingreso := old.lat_ingreso;
    new.lng_ingreso := old.lng_ingreso;
  end if;
  if old.hora_salida is not null then
    new.hora_salida := old.hora_salida;
    new.lat_salida := old.lat_salida;
    new.lng_salida := old.lng_salida;
    new.salida_en := old.salida_en;
  elsif new.hora_salida is not null then
    new.salida_en := now();
  end if;
  return new;
end
$protasis$;

create trigger proteger_asistencias before update on public.asistencias
  for each row execute function public.proteger_asistencia();

alter table public.asistencias enable row level security;

create policy asistencias_ver on public.asistencias for select to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or (public.mi_rol() <> 'asesor' and public.veo_zona(zona_id))));
create policy asistencias_crear on public.asistencias for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() <> 'gerencia');
create policy asistencias_editar on public.asistencias for update to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'))
  with check (empresa_id = public.mi_empresa());

grant select, insert, update on public.asistencias to authenticated;
revoke all on function public.proteger_asistencia() from public;

-- ---------- Primera mensualidad ---------------------------------------------
alter table public.ventas
  add column cuota_estado text not null default 'pendiente'
    check (cuota_estado in ('pendiente', 'reportada', 'confirmada')),
  add column cuota_medio text,
  add column cuota_operacion text,
  add column cuota_centimos integer check (cuota_centimos is null or cuota_centimos >= 0),
  add column cuota_fecha date,
  add column cuota_nota text,
  add column cuota_confirmada_por uuid references public.perfiles(id),
  add column cuota_confirmada_en timestamptz,
  add column cuota_recordada_en timestamptz;

create index ventas_cuota on public.ventas (empresa_id, cuota_estado);

-- El asesor reporta el pago; solo supervisor o jefe lo confirman. Una cuota
-- confirmada ya no la cambia el asesor. Quién y cuándo confirma lo pone el
-- servidor.
create function public.proteger_cuota() returns trigger
language plpgsql security definer set search_path = public as $protcuota$
begin
  if public.mi_rol() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.cuota_estado = 'confirmada' and public.mi_rol() = 'asesor' then
      new.cuota_estado := 'reportada';
    end if;
    if new.cuota_estado = 'confirmada' then
      new.cuota_confirmada_por := public.mi_perfil();
      new.cuota_confirmada_en := now();
    else
      new.cuota_confirmada_por := null;
      new.cuota_confirmada_en := null;
    end if;
    return new;
  end if;

  if public.mi_rol() = 'asesor' then
    if old.cuota_estado = 'confirmada' then
      new.cuota_estado := old.cuota_estado;
      new.cuota_medio := old.cuota_medio;
      new.cuota_operacion := old.cuota_operacion;
      new.cuota_centimos := old.cuota_centimos;
      new.cuota_fecha := old.cuota_fecha;
      new.cuota_nota := old.cuota_nota;
    elsif new.cuota_estado = 'confirmada' then
      raise exception 'Solo el supervisor o el jefe confirman el pago';
    end if;
    new.cuota_recordada_en := old.cuota_recordada_en;
  end if;

  if new.cuota_estado = 'confirmada' and old.cuota_estado <> 'confirmada' then
    new.cuota_confirmada_por := public.mi_perfil();
    new.cuota_confirmada_en := now();
  elsif new.cuota_estado <> 'confirmada' then
    new.cuota_confirmada_por := null;
    new.cuota_confirmada_en := null;
  else
    new.cuota_confirmada_por := old.cuota_confirmada_por;
    new.cuota_confirmada_en := old.cuota_confirmada_en;
  end if;
  return new;
end
$protcuota$;

create trigger proteger_cuotas before insert or update on public.ventas
  for each row execute function public.proteger_cuota();

revoke all on function public.proteger_cuota() from public;

commit;

-- ============================================================================
-- LX Ventas · 001 · Base de datos
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- Multiempresa: cada fila lleva empresa_id y el RLS aísla a cada empresa.
-- Roles: asesor, supervisor, jefe, gerencia.
-- ============================================================================
begin;

-- ---------- Fundación --------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.zonas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  nombre text not null,
  supervisor_id uuid,
  meta_mensual integer not null default 60 check (meta_mensual >= 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table public.perfiles (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  nombre text not null,
  usuario text not null,
  rol text not null check (rol in ('asesor', 'supervisor', 'jefe', 'gerencia')),
  zona_id uuid references public.zonas(id),
  telefono text,
  meta_mensual integer not null default 20 check (meta_mensual >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, usuario)
);

alter table public.zonas
  add constraint zonas_supervisor_fk foreign key (supervisor_id) references public.perfiles(id);

create table public.configuracion (
  empresa_id uuid primary key references public.empresas(id),
  nombre_zona text not null default 'UGEL',
  nombre_lugar text not null default 'Colegio',
  nombre_contacto text not null default 'Docente',
  producto text not null default 'Especialización',
  firma text not null default '',
  valor_venta_centimos integer not null default 186000,
  meta_semanal_zona integer not null default 15,
  dias_interes_alto integer not null default 2,
  dias_interes_medio integer not null default 5,
  dias_interes_bajo integer not null default 15,
  dias_escalar_supervisor integer not null default 7,
  dia_corte_planilla integer check (dia_corte_planilla between 1 and 31),
  condicion_valida text not null default 'NOMBRAD',
  pago_valido text not null default 'PLANILLA'
);

-- ---------- Negocio ----------------------------------------------------------
create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  zona_id uuid references public.zonas(id),
  asesor_id uuid not null references public.perfiles(id),
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  hora text,
  lugar text not null,
  resultado text not null,
  con_ingreso boolean not null default true,
  numero text,
  niveles text,
  contactos integer not null default 0,
  ventas_declaradas integer not null default 0,
  movilidad_centimos integer not null default 0,
  director text,
  celular text,
  direccion text,
  referencia text,
  psi text,
  observacion text,
  idem_key text not null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, idem_key)
);

create table public.prospectos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  zona_id uuid references public.zonas(id),
  asesor_id uuid not null references public.perfiles(id),
  nombre text not null,
  celular text,
  lugar text,
  condicion text,
  interes text not null default 'medio' check (interes in ('alto', 'medio', 'bajo')),
  motivo text,
  comentario text,
  referido_por text,
  estado text not null default 'abierto' check (estado in ('abierto', 'ganado', 'perdido', 'pausado')),
  motivo_perdida text,
  paso integer not null default 1,
  proximo_contacto date,
  ultimo_contacto date,
  idem_key text not null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, idem_key)
);

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  prospecto_id uuid not null references public.prospectos(id) on delete cascade,
  asesor_id uuid not null references public.perfiles(id),
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  paso integer,
  resultado text not null,
  nota text,
  creado_en timestamptz not null default now()
);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  zona_id uuid references public.zonas(id),
  asesor_id uuid not null references public.perfiles(id),
  prospecto_id uuid references public.prospectos(id) on delete set null,
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  hora text,
  nombre text not null,
  dni text,
  celular text,
  correo text,
  lugar text,
  desempeno text,
  condicion text,
  pago text,
  programa text,
  estrategia text,
  suscripcion text,
  beneficiario text,
  observacion text,
  estado text not null default 'registrada' check (estado in ('registrada', 'caida')),
  motivo_caida text,
  idem_key text not null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, idem_key)
);

create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  paso integer not null,
  motivo text,
  titulo text not null,
  texto text not null,
  activa boolean not null default true
);

create index visitas_empresa_fecha on public.visitas (empresa_id, fecha);
create index ventas_empresa_fecha on public.ventas (empresa_id, fecha);
create index prospectos_asesor_estado on public.prospectos (asesor_id, estado, proximo_contacto);
create index contactos_prospecto on public.contactos (prospecto_id);

-- ---------- Funciones de sesión ---------------------------------------------
create function public.mi_perfil() returns uuid
language sql stable security definer set search_path = public as $miperfil$
  select id from public.perfiles where usuario_id = auth.uid() and activo
$miperfil$;

create function public.mi_empresa() returns uuid
language sql stable security definer set search_path = public as $miempresa$
  select empresa_id from public.perfiles where usuario_id = auth.uid() and activo
$miempresa$;

create function public.mi_rol() returns text
language sql stable security definer set search_path = public as $mirol$
  select rol from public.perfiles where usuario_id = auth.uid() and activo
$mirol$;

create function public.mi_zona() returns uuid
language sql stable security definer set search_path = public as $mizona$
  select zona_id from public.perfiles where usuario_id = auth.uid() and activo
$mizona$;

-- ¿El usuario conectado puede ver esta zona?
create function public.veo_zona(p_zona uuid) returns boolean
language sql stable security definer set search_path = public as $veozona$
  select case
    when public.mi_rol() in ('jefe', 'gerencia') then true
    when p_zona is null then false
    when public.mi_rol() = 'supervisor' then exists (
      select 1 from public.zonas z where z.id = p_zona and z.supervisor_id = public.mi_perfil())
    else p_zona = public.mi_zona()
  end
$veozona$;

-- Al insertar, la empresa, el asesor y la zona los pone el servidor.
create function public.sellar_registro() returns trigger
language plpgsql security definer set search_path = public as $sellar$
begin
  if public.mi_perfil() is null then
    return new;
  end if;
  new.empresa_id := public.mi_empresa();
  if public.mi_rol() = 'asesor' or new.asesor_id is null then
    new.asesor_id := public.mi_perfil();
  end if;
  if tg_table_name <> 'contactos' then
    if public.mi_rol() = 'asesor' or new.zona_id is null then
      new.zona_id := (select zona_id from public.perfiles where id = new.asesor_id);
    end if;
  end if;
  return new;
end
$sellar$;

create trigger sellar_visitas before insert on public.visitas for each row execute function public.sellar_registro();
create trigger sellar_ventas before insert on public.ventas for each row execute function public.sellar_registro();
create trigger sellar_prospectos before insert on public.prospectos for each row execute function public.sellar_registro();
create trigger sellar_contactos before insert on public.contactos for each row execute function public.sellar_registro();

-- ---------- Seguridad por fila (RLS) ----------------------------------------
alter table public.empresas enable row level security;
alter table public.zonas enable row level security;
alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.visitas enable row level security;
alter table public.prospectos enable row level security;
alter table public.contactos enable row level security;
alter table public.ventas enable row level security;
alter table public.plantillas enable row level security;

create policy empresas_ver on public.empresas for select to authenticated
  using (id = public.mi_empresa());

create policy zonas_ver on public.zonas for select to authenticated
  using (empresa_id = public.mi_empresa());
create policy zonas_crear on public.zonas for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe');
create policy zonas_editar on public.zonas for update to authenticated
  using (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe')
  with check (empresa_id = public.mi_empresa());

create policy perfiles_ver on public.perfiles for select to authenticated
  using (usuario_id = auth.uid()
    or (empresa_id = public.mi_empresa()
        and (public.mi_rol() in ('jefe', 'gerencia')
             or (public.mi_rol() = 'supervisor' and public.veo_zona(zona_id)))));
create policy perfiles_editar on public.perfiles for update to authenticated
  using (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe')
  with check (empresa_id = public.mi_empresa());

create policy configuracion_ver on public.configuracion for select to authenticated
  using (empresa_id = public.mi_empresa());
create policy configuracion_editar on public.configuracion for update to authenticated
  using (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe')
  with check (empresa_id = public.mi_empresa());

create policy plantillas_ver on public.plantillas for select to authenticated
  using (empresa_id = public.mi_empresa());
create policy plantillas_crear on public.plantillas for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe');
create policy plantillas_editar on public.plantillas for update to authenticated
  using (empresa_id = public.mi_empresa() and public.mi_rol() = 'jefe')
  with check (empresa_id = public.mi_empresa());

-- Visitas, ventas y prospectos: el asesor ve lo suyo; supervisor, sus zonas;
-- jefe y gerencia, toda la empresa.
create policy visitas_ver on public.visitas for select to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or (public.mi_rol() <> 'asesor' and public.veo_zona(zona_id))));
create policy visitas_crear on public.visitas for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() <> 'gerencia');
create policy visitas_editar on public.visitas for update to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'))
  with check (empresa_id = public.mi_empresa());
create policy visitas_borrar on public.visitas for delete to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'));

create policy ventas_ver on public.ventas for select to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or (public.mi_rol() <> 'asesor' and public.veo_zona(zona_id))));
create policy ventas_crear on public.ventas for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() <> 'gerencia');
create policy ventas_editar on public.ventas for update to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'
         or (public.mi_rol() = 'supervisor' and public.veo_zona(zona_id))))
  with check (empresa_id = public.mi_empresa());
create policy ventas_borrar on public.ventas for delete to authenticated
  using (empresa_id = public.mi_empresa() and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'));

create policy prospectos_ver on public.prospectos for select to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or (public.mi_rol() <> 'asesor' and public.veo_zona(zona_id))));
create policy prospectos_crear on public.prospectos for insert to authenticated
  with check (empresa_id = public.mi_empresa() and public.mi_rol() <> 'gerencia');
create policy prospectos_editar on public.prospectos for update to authenticated
  using (empresa_id = public.mi_empresa()
    and (asesor_id = public.mi_perfil() or public.mi_rol() = 'jefe'
         or (public.mi_rol() = 'supervisor' and public.veo_zona(zona_id))))
  with check (empresa_id = public.mi_empresa());

create policy contactos_ver on public.contactos for select to authenticated
  using (empresa_id = public.mi_empresa()
    and exists (select 1 from public.prospectos p where p.id = prospecto_id));
create policy contactos_crear on public.contactos for insert to authenticated
  with check (empresa_id = public.mi_empresa()
    and exists (select 1 from public.prospectos p where p.id = prospecto_id));

-- ---------- Permisos ---------------------------------------------------------
grant usage on schema public to authenticated;
grant select on public.empresas to authenticated;
grant select, insert, update on public.zonas, public.configuracion, public.plantillas to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.visitas, public.ventas to authenticated;
grant select, insert, update on public.prospectos to authenticated;
grant select, insert on public.contactos to authenticated;
grant execute on function public.mi_perfil(), public.mi_empresa(), public.mi_rol(), public.mi_zona(), public.veo_zona(uuid) to authenticated;
revoke all on function public.sellar_registro() from public;

-- ---------- Alta de una empresa (solo desde el SQL Editor) -------------------
-- Crea la empresa, su configuración, sus mensajes de seguimiento y el perfil
-- de jefe para un usuario que ya existe en Authentication.
create function public.instalar_empresa(p_empresa text, p_correo text, p_nombre text)
returns text
language plpgsql security definer set search_path = public as $instalar$
declare
  v_usuario uuid;
  v_empresa uuid;
begin
  select id into v_usuario from auth.users where lower(email) = lower(trim(p_correo));
  if v_usuario is null then
    return 'No existe un usuario con ese correo en Authentication. Créalo primero.';
  end if;
  if exists (select 1 from public.perfiles where usuario_id = v_usuario) then
    return 'Ese usuario ya tiene un perfil. No se cambió nada.';
  end if;

  insert into public.empresas (nombre) values (trim(p_empresa)) returning id into v_empresa;
  insert into public.configuracion (empresa_id, firma) values (v_empresa, trim(p_empresa));
  insert into public.perfiles (usuario_id, empresa_id, nombre, usuario, rol, meta_mensual)
    values (v_usuario, v_empresa, trim(p_nombre), lower(trim(p_correo)), 'jefe', 0);

  insert into public.plantillas (empresa_id, paso, motivo, titulo, texto) values
    (v_empresa, 1, null, 'Agradecimiento del mismo día',
     'Buenas tardes, {nombre}. Le saluda {asesor}, de {firma}. Gracias por atenderme hoy en {lugar}. Le dejo por aquí la información de {producto} para que la revise con calma. Cualquier consulta, me escribe por este medio.'),
    (v_empresa, 2, null, 'Seguimiento',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Le escribo para saber si pudo revisar la información de {producto} y si le quedó alguna consulta.'),
    (v_empresa, 2, 'PRECIO', 'Seguimiento: precio',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Sobre el costo de {producto}: el pago es en cuotas mensuales por descuento por planilla. ¿Le explico cómo quedaría en su caso?'),
    (v_empresa, 2, 'TIEMPO', 'Seguimiento: tiempo',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Sobre el tiempo que le preocupaba: le cuento cómo es la modalidad y el horario de {producto} para que vea si se acomoda a su carga. ¿Le parece si lo conversamos hoy?'),
    (v_empresa, 2, 'CONSULTAR', 'Seguimiento: iba a consultarlo',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Quedamos en que iba a consultarlo en casa. ¿Pudo conversarlo? Si le sirve, le envío un resumen para compartir.'),
    (v_empresa, 2, 'DESCONFIANZA', 'Seguimiento: confianza',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Entiendo que quiera asegurarse antes de decidir. Le puedo enviar los datos de la empresa y el modelo de certificado de {producto} para que lo verifique.'),
    (v_empresa, 3, null, 'Retomar la conversación',
     'Buenas tardes, {nombre}. Le saluda {asesor}, de {firma}. Le escribo para retomar lo que conversamos sobre {producto}. ¿Coordinamos una llamada corta para resolver lo que falte?'),
    (v_empresa, 4, null, 'Fecha límite',
     'Buenos días, {nombre}. Le saluda {asesor}, de {firma}. Para que su inscripción en {producto} entre en la planilla de este mes, debo registrarla antes del {fecha_corte}. ¿Lo dejamos listo hoy?'),
    (v_empresa, 9, null, 'Pedir referidos',
     'Gracias por su confianza, {nombre}. Si conoce a dos colegas a quienes les pueda interesar {producto}, ¿me comparte sus nombres para comentarles?');

  return 'Listo: empresa creada y ' || trim(p_nombre) || ' quedó como jefe.';
end
$instalar$;

revoke all on function public.instalar_empresa(text, text, text) from public;
revoke all on function public.instalar_empresa(text, text, text) from anon, authenticated;

commit;

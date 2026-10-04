-- ============================================================================
-- LX Ventas · 002 · Bajas con autorización del jefe
-- El supervisor pide la baja de un asesor de su equipo; el jefe la aprueba
-- (lo desactiva) o la rechaza. Pegar COMPLETO en el SQL Editor y pulsar Run.
-- ============================================================================
begin;

alter table public.perfiles
  add column baja_solicitada_por uuid references public.perfiles(id),
  add column baja_motivo text,
  add column baja_solicitada_en timestamptz;

create function public.solicitar_baja(p_perfil uuid, p_motivo text) returns text
language plpgsql security definer set search_path = public as $solicitar$
declare
  v_destino public.perfiles%rowtype;
begin
  if public.mi_rol() is null or public.mi_rol() not in ('supervisor', 'jefe') then
    raise exception 'Solo un supervisor puede pedir una baja';
  end if;
  select * into v_destino from public.perfiles where id = p_perfil and empresa_id = public.mi_empresa();
  if v_destino.id is null or v_destino.rol <> 'asesor' or not public.veo_zona(v_destino.zona_id) then
    raise exception 'Ese asesor no es de tu equipo';
  end if;
  update public.perfiles
     set baja_solicitada_por = public.mi_perfil(),
         baja_motivo = nullif(trim(p_motivo), ''),
         baja_solicitada_en = now()
   where id = p_perfil;
  return 'ok';
end
$solicitar$;

create function public.cancelar_baja(p_perfil uuid) returns text
language plpgsql security definer set search_path = public as $cancelar$
begin
  update public.perfiles
     set baja_solicitada_por = null, baja_motivo = null, baja_solicitada_en = null
   where id = p_perfil
     and empresa_id = public.mi_empresa()
     and (public.mi_rol() = 'jefe' or baja_solicitada_por = public.mi_perfil());
  return 'ok';
end
$cancelar$;

revoke all on function public.solicitar_baja(uuid, text) from public;
revoke all on function public.cancelar_baja(uuid) from public;
grant execute on function public.solicitar_baja(uuid, text), public.cancelar_baja(uuid) to authenticated;

commit;

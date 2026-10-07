-- ============================================================================
-- LX Ventas · 006 · Fecha de compromiso de pago
-- Cuando el cliente no paga la primera mensualidad en el momento, la venta
-- guarda qué día se comprometió a pagar y cuántas veces se cambió esa fecha.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- ============================================================================
begin;

alter table public.ventas
  add column cuota_compromiso date,
  add column cuota_reprogramaciones integer not null default 0;

-- Misma regla de la 003, más el compromiso: una cuota confirmada ya no la
-- cambia el asesor, y cada cambio de fecha de compromiso queda contado.
create or replace function public.proteger_cuota() returns trigger
language plpgsql security definer set search_path = public as $protcuotados$
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
    new.cuota_reprogramaciones := 0;
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
      new.cuota_compromiso := old.cuota_compromiso;
    elsif new.cuota_estado = 'confirmada' then
      raise exception 'Solo el supervisor o el jefe confirman el pago';
    end if;
    new.cuota_recordada_en := old.cuota_recordada_en;
  end if;

  new.cuota_reprogramaciones := old.cuota_reprogramaciones;
  if old.cuota_compromiso is not null and new.cuota_compromiso is not null
     and new.cuota_compromiso <> old.cuota_compromiso then
    new.cuota_reprogramaciones := old.cuota_reprogramaciones + 1;
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
$protcuotados$;

commit;

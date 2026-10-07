-- ============================================================================
-- LX Ventas · 004 · Periodo por zona y datos del contrato
-- 1) Cada zona puede tener su fecha de apertura: su "mes" de venta corre desde
--    ese día (por ejemplo, del 9 de octubre al 9 de noviembre) y no por mes
--    calendario. Sin fecha de apertura, sigue por mes calendario.
-- 2) La venta guarda los datos que pide el contrato y qué documentos firmó
--    el cliente.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- ============================================================================
begin;

alter table public.zonas
  add column fecha_apertura date;

alter table public.ventas
  add column direccion text,
  add column distrito text,
  add column provincia text,
  add column fecha_alta date,
  add column sueldo_centimos integer check (sueldo_centimos is null or sueldo_centimos >= 0),
  add column afp text,
  add column cuspp text,
  add column profesion text,
  add column doc_contrato boolean not null default false,
  add column doc_planilla boolean not null default false,
  add column doc_compromiso boolean not null default false,
  add column doc_dni boolean not null default false;

commit;

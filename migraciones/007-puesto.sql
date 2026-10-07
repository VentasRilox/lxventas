-- ============================================================================
-- LX Ventas · 007 · Puesto de la persona registrada
-- Al registrar a una persona se guarda su puesto (docente, director,
-- auxiliar), para llevarlo a la venta y verlo en la cartera.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- ============================================================================
begin;

alter table public.prospectos
  add column puesto text;

commit;

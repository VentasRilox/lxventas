-- ============================================================================
-- LX Ventas · 005 · Dominio de los correos del equipo
-- Cada empresa elige con qué dominio se crean los accesos de su gente
-- (por ejemplo, oaguilar@marketing.com). Sin dominio, sigue usando lxventas.com.
-- Pegar COMPLETO en el SQL Editor de Supabase y pulsar Run. Se ejecuta una vez.
-- ============================================================================
begin;

alter table public.configuracion
  add column dominio_correo text;

commit;

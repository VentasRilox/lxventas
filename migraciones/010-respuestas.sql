-- ============================================================================
-- LX Ventas · 010 · Respuestas a las dudas del docente
-- Guarda las respuestas que el jefe escribe en Ajustes para cada duda
-- (precio, tiempo, etc.). Vacío = la app usa sus respuestas de ejemplo.
-- Pegar en el SQL Editor de Supabase y pulsar Run. Se puede correr más de una vez.
-- ============================================================================
alter table public.configuracion
  add column if not exists respuestas jsonb;

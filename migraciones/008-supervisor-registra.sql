-- 008 · Interruptor para que el supervisor pueda registrar personas y ventas.
-- Apagado por defecto: el jefe lo enciende en Ajustes cuando lo necesite.
-- Se puede correr más de una vez sin problema.

alter table public.configuracion
  add column if not exists supervisor_registra boolean not null default false;

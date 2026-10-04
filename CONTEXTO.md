# Contexto del proyecto — LX Ventas

Documento para sesiones de desarrollo asistido. Léelo antes de escribir código.

## Qué es

Sistema para equipos de venta en campo: el asesor registra visitas, ventas y prospectos desde el celular; supervisor, jefe de ventas y gerencia ven el avance por zona. Primer cliente: una empresa que vende especializaciones a docentes de colegios públicos, zona por zona (UGEL).

Multiempresa: cada fila lleva `empresa_id` y el RLS aísla a cada empresa.

## Stack

Igual que LX Cobros: React + Vite (JavaScript), Supabase (Postgres, Auth, RLS, Edge Functions), react-router-dom, CSS plano. Proyecto Supabase `lxventas` (organización Ventas, región São Paulo).

## Roles

| Rol | Ve | Hace |
|---|---|---|
| `asesor` | Lo suyo | Visitas, ventas, seguimiento de prospectos |
| `supervisor` | Sus zonas (`zonas.supervisor_id`) | Panel, marca ventas caídas, también puede registrar |
| `jefe` | Toda la empresa | Panel, equipo, zonas, ajustes, reasigna cartera |
| `gerencia` | Toda la empresa | Solo lectura |

## Base de datos

Definida en `migraciones/001-base.sql`. Tablas: `empresas`, `zonas`, `perfiles`, `configuracion`, `visitas`, `ventas`, `prospectos`, `contactos`, `plantillas`.

Funciones de sesión: `mi_perfil()`, `mi_empresa()`, `mi_rol()`, `mi_zona()`, `veo_zona(uuid)`. El trigger `sellar_registro` pone empresa, asesor y zona al insertar: el cliente no puede falsearlos.

Alta de una empresa nueva: crear el usuario en Authentication y ejecutar en el SQL Editor `select public.instalar_empresa('Empresa', 'correo', 'Nombre del jefe');`.

Los usuarios del equipo se crean desde la pantalla Equipo, que llama a la Edge Function `crear-usuario` (única pieza con la llave secreta). Un usuario sin correo entra como `usuario@lxventas.com`.

## Reglas que no se negocian

- Dinero en enteros de céntimos (`_centimos`).
- Nunca `toISOString()` ni `current_date`: fechas locales en JS y `(now() at time zone 'America/Lima')::date` en SQL.
- Nunca `$$` en SQL ni dos bloques con la misma etiqueta en un archivo: el SQL Editor de Supabase los corrompe.
- El perfil se lee con `perfiles.usuario_id = auth.uid()`, nunca con `perfiles.id`.
- Toda vista SQL lleva `security_invoker=on`.
- Venta válida = condición y pago que contienen los textos de `configuracion` (`NOMBRAD` y `PLANILLA`) y estado distinto de `caida`. Solo las válidas cuentan para metas y bonos.
- Visitas, ventas y prospectos llevan `idem_key` (único por empresa): reenviar nunca duplica. Sin señal, visitas y ventas quedan en una cola en el celular (`src/lib/cola.js`) hasta que vuelve la conexión; es la única excepción a no guardar datos de negocio en localStorage.
- Los mensajes de seguimiento salen de `plantillas` y solo deben afirmar cosas ciertas del producto.

## Pendiente

- La escala de pagos (básicos, premios y bonos) está fija en `src/lib/reglas.js`; debe pasar a `configuracion` cuando haya un segundo cliente.
- Reactivación automática de prospectos pausados al inicio del año escolar.
- Notificaciones al celular (hoy las alertas se ven al abrir la app).

## Quién trabaja aquí

El dueño del proyecto dirige y revisa; no programa. Explica en español, un paso a la vez, y da una evaluación honesta antes que un "listo" apresurado.

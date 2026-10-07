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

Definida en `migraciones/` (se ejecutan en orden: 001, 002, 003, 004, 005, 006, 007). Tablas: `empresas`, `zonas`, `perfiles`, `configuracion`, `visitas`, `ventas`, `prospectos`, `contactos`, `plantillas`, `asistencias`.

Funciones de sesión: `mi_perfil()`, `mi_empresa()`, `mi_rol()`, `mi_zona()`, `veo_zona(uuid)`. El trigger `sellar_registro` pone empresa, asesor y zona al insertar: el cliente no puede falsearlos.

Alta de una empresa nueva: crear el usuario en Authentication y ejecutar en el SQL Editor `select public.instalar_empresa('Empresa', 'correo', 'Nombre del jefe');`.

Los usuarios del equipo se crean desde la pantalla Equipo, que llama a la Edge Function `crear-usuario` (única pieza con la llave secreta). Los accesos se crean como `usuario@dominio`: el dominio es `configuracion.dominio_correo` de la empresa o, si no tiene, `lxventas.com`. En el ingreso se puede escribir el correo completo o solo el usuario.

## Flujo del asesor

Cada persona se registra una sola vez, en `/docente` (pantalla `NuevoProspecto.jsx`). Ahí se marca qué pasó: **compró** (sigue a `/venta` con sus datos ya puestos), **quedó interesado** (entra a la cartera con la fecha para volver a llamarlo) o **no le interesa** (queda anotado con su motivo). La venta no está en el menú: se llega desde ese registro o desde la ficha de alguien en cartera. Al guardar una visita con ingreso, la app ofrece registrar a las personas de ese lugar.

## Reglas que no se negocian

- Dinero en enteros de céntimos (`_centimos`).
- Nunca `toISOString()` ni `current_date`: fechas locales en JS y `(now() at time zone 'America/Lima')::date` en SQL.
- Nunca `$$` en SQL ni dos bloques con la misma etiqueta en un archivo: el SQL Editor de Supabase los corrompe.
- El perfil se lee con `perfiles.usuario_id = auth.uid()`, nunca con `perfiles.id`.
- Toda vista SQL lleva `security_invoker=on`.
- Venta válida = condición y pago que contienen los textos de `configuracion` (`NOMBRAD` y `PLANILLA`), estado distinto de `caida` y primera mensualidad confirmada (`ventas.cuota_estado = 'confirmada'`). Solo las válidas cuentan para metas, bonos y caja.
- Primera mensualidad: `pendiente` → `reportada` (el asesor avisa que ya se pagó) → `confirmada` (solo supervisor o jefe; lo impone el trigger `proteger_cuota`). El supervisor le hace seguimiento en Panel › Cobros. Si no paga en el momento, la venta guarda `cuota_compromiso` (el día en que prometió pagar): la alerta salta cuando esa fecha vence, y cada cambio de fecha se cuenta en `cuota_reprogramaciones`.
- Periodo de venta: si la zona tiene `fecha_apertura`, su "mes" corre desde ese día (abre el 9 de octubre → 9 oct al 9 nov; luego 10 nov al 9 dic). El primer periodo también cuenta lo registrado hasta 45 días antes de abrir. Sin fecha, es el mes calendario. Todo el cálculo está en `src/lib/periodo.js`; el panel y "Mi avance" miden por periodo, nunca por mes calendario directo.
- Contrato: por defecto se llena en papel y la app no lo pide. Las columnas del contrato y de documentos (`doc_*`) existen en `ventas`; la pantalla solo las muestra si `configuracion.pide_contrato` es verdadero (columna aún no creada: agregarla cuando un cliente lo pida). Con eso activo, la venta guarda los datos del contrato y los documentos firmados. No bloquean la venta: se pueden completar después abriendo `/venta?id=<venta>` desde "Mi avance".
- Jornada: el asesor marca ingreso y salida en la pantalla Hoy (`asistencias`, una fila por asesor y día, con hora y ubicación). Lo marcado no se cambia (trigger `proteger_asistencia`); solo el jefe corrige. Se revisa en Panel › Asistencia.
- Visitas, ventas y prospectos llevan `idem_key` (único por empresa): reenviar nunca duplica. Sin señal, visitas y ventas quedan en una cola en el celular (`src/lib/cola.js`) hasta que vuelve la conexión; es la única excepción a no guardar datos de negocio en localStorage.
- Los mensajes de seguimiento salen de `plantillas` y solo deben afirmar cosas ciertas del producto.

## Pendiente

- Fotos de evidencia (punto de encuentro, voucher del pago, contrato): requieren Supabase Storage; hoy siguen yendo por WhatsApp.
- Asistencia del supervisor, movilidad con tope diario y metas del día (visitas, demostraciones, colegios) en la pantalla Hoy.
- Enlace o QR para que el docente deje sus datos (ticket de media beca).

- La escala de pagos (básicos, premios y bonos) está fija en `src/lib/reglas.js`; debe pasar a `configuracion` cuando haya un segundo cliente.
- Reactivación automática de prospectos pausados al inicio del año escolar.
- Notificaciones al celular (hoy las alertas se ven al abrir la app).

## Quién trabaja aquí

El dueño del proyecto dirige y revisa; no programa. Explica en español, un paso a la vez, y da una evaluación honesta antes que un "listo" apresurado.

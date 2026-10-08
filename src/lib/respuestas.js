// Qué responder ante cada duda del docente. Son ejemplos: el jefe las ajusta
// en Ajustes para que digan solo lo que es cierto del producto.
// {cuota} se reemplaza por el monto de la primera mensualidad.
export const RESPUESTAS_BASE = {
  PRECIO: [
    'No lo paga de golpe: son cuotas mensuales con descuento por planilla. La primera mensualidad es de {cuota}.',
    'Pregúntele cuánto vale para usted crecer en su carrera. Ayúdelo a verlo como inversión, no como gasto.',
    'Si hoy no le alcanza, acuerde el día de su primera mensualidad y regístrelo.',
  ],
  TIEMPO: [
    'Pregúntele cuánto tiempo libre tiene a la semana y muéstrele cómo se organiza el programa.',
    'Confirme modalidad y horarios antes de prometer: diga solo lo que es cierto del programa.',
    'Proponga una fecha concreta para empezar y regístrela.',
  ],
  CONSULTAR: [
    'Pregunte con quién lo va a consultar y ofrezca explicarles juntos, por llamada o WhatsApp.',
    'Envíele por WhatsApp un resumen corto para que lo muestre.',
    'Deje día y hora concretos para volver a llamar y regístrelos.',
  ],
  OTRA: [
    'Pregunte qué está estudiando y cuándo termina: este programa puede ser su siguiente paso.',
    'Muéstrele qué cambia con este programa: tema, duración y forma de pago.',
    'Si no es ahora, registre cuándo termina y agende el contacto para esa fecha.',
  ],
  DESCONFIANZA: [
    'Muéstrele su fotocheck y deje que verifique los datos de la empresa.',
    'Explíquele que todo queda por escrito: contrato, descuento por planilla y compromiso de pago.',
    'Si un colega de su colegio ya se inscribió, ofrézcale conversar con él.',
  ],
}

export function respuestasPara(motivo, cfg) {
  const propias = cfg?.respuestas?.[motivo]
  const lista = Array.isArray(propias) && propias.length ? propias : RESPUESTAS_BASE[motivo] ?? []
  const cuota = `S/ ${((cfg?.primera_cuota_centimos ?? 13000) / 100).toFixed(0)}`
  return lista.map((t) => t.replaceAll('{cuota}', cuota))
}

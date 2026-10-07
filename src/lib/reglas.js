// Reglas del negocio que usan el asesor y el panel. Los textos que deciden si
// una venta es válida vienen de la configuración de la empresa.

export function mayus(texto) {
  return String(texto ?? '').trim().toUpperCase()
}

function sinTildes(texto) {
  return mayus(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// "ESPECIALIZACION DE EDUCACIÓN" → "Especializacion de Educación". Las palabras
// de enlace van en minúscula y los espacios dobles se quitan.
const ENLACES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'a', 'con', 'para', 'por'])

export function titulo(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((palabra, i) => (i > 0 && ENLACES.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)))
    .join(' ')
}

export function soles(centimos) {
  return 'S/ ' + Math.round((centimos ?? 0) / 100).toLocaleString('en-US')
}

export const SIN_INGRESO = ['NO OBTUVIMOS INGRESO', 'VISITA REPROGRAMADA']

export function visitaConIngreso(resultado) {
  return !SIN_INGRESO.includes(mayus(resultado))
}

export function esCaida(venta) {
  return venta.estado === 'caida'
}

// ¿Cumple las condiciones de la venta? (por ejemplo: nombrado y con planilla)
export function cumpleCondiciones(venta, cfg) {
  const condicion = sinTildes(venta.condicion).includes(sinTildes(cfg?.condicion_valida ?? 'NOMBRAD'))
  const pago = sinTildes(venta.pago).includes(sinTildes(cfg?.pago_valido ?? 'PLANILLA'))
  return condicion && pago
}

export function cuotaConfirmada(venta) {
  return venta.cuota_estado === 'confirmada'
}

// Venta válida: cumple las condiciones y su primera mensualidad está
// confirmada. Es la única que cuenta para metas, bonos y caja.
export function esValida(venta, cfg) {
  return !esCaida(venta) && cumpleCondiciones(venta, cfg) && cuotaConfirmada(venta)
}

// Cumple las condiciones, pero todavía no tiene la primera mensualidad confirmada.
export function faltaPago(venta, cfg) {
  return !esCaida(venta) && cumpleCondiciones(venta, cfg) && !cuotaConfirmada(venta)
}

export function motivoNoValida(venta, cfg) {
  if (esCaida(venta)) return 'Caída'
  if (!sinTildes(venta.condicion).includes(sinTildes(cfg?.condicion_valida ?? 'NOMBRAD'))) return 'No nombrado'
  if (!cumpleCondiciones(venta, cfg)) return 'Sin planilla'
  return venta.cuota_estado === 'reportada' ? 'Pago por confirmar' : 'Falta pago'
}

// Etiqueta de estado de una venta: [color, texto].
export function estadoVenta(venta, cfg) {
  if (esValida(venta, cfg)) return ['ok', 'Válida']
  return [esCaida(venta) ? 'crit' : 'warn', motivoNoValida(venta, cfg)]
}

// Monto de la primera mensualidad de una venta, en céntimos.
export function montoCuota(venta, cfg) {
  return venta.cuota_centimos ?? cfg?.primera_cuota_centimos ?? 13000
}

export const MEDIOS_CUOTA = ['Yape', 'Cuenta de la empresa']

// Cómo va el cobro de una venta sin pagar: { clase, texto, vencida }.
// Con fecha de compromiso manda esa fecha; sin ella, los días desde la venta.
export function estadoCompromiso(venta, hoy, diasAlerta = 3) {
  const dias = (desde, hasta) => Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000)
  const corta = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
  if (venta.cuota_compromiso) {
    const faltan = dias(hoy, venta.cuota_compromiso)
    if (faltan < 0) return { clase: 'crit', texto: `Venció hace ${-faltan} ${faltan === -1 ? 'día' : 'días'}`, vencida: true }
    if (faltan === 0) return { clase: 'warn', texto: 'Paga hoy', vencida: false }
    return { clase: 'neu', texto: `Paga el ${corta(venta.cuota_compromiso)}`, vencida: false }
  }
  const pasaron = dias(venta.fecha, hoy)
  return { clase: pasaron >= diasAlerta ? 'crit' : 'warn', texto: pasaron === 0 ? 'Sin fecha de pago' : `${pasaron} ${pasaron === 1 ? 'día' : 'días'} sin fecha`, vencida: pasaron >= diasAlerta }
}

// Datos que pide el contrato y documentos que firma el cliente.
export const DATOS_CONTRATO = [
  ['celular', 'celular'], ['correo', 'correo'], ['direccion', 'dirección'], ['distrito', 'distrito'], ['provincia', 'provincia'],
  ['desempeno', 'puesto'], ['fecha_alta', 'fecha de alta'], ['sueldo_centimos', 'sueldo'], ['afp', 'AFP'], ['cuspp', 'código CUSPP'], ['profesion', 'profesión'],
]

export const DOCUMENTOS = [
  ['doc_contrato', 'Contrato (doble cara)'],
  ['doc_planilla', 'Descuento por planilla'],
  ['doc_compromiso', 'Compromiso de pago'],
  ['doc_dni', 'Foto del DNI'],
]

// Lo que le falta a una venta para tener el contrato completo.
export function faltaContrato(venta) {
  const datos = DATOS_CONTRATO.filter(([campo]) => venta[campo] === null || venta[campo] === undefined || venta[campo] === '').map((d) => d[1])
  const documentos = DOCUMENTOS.filter(([campo]) => !venta[campo]).map((d) => d[1].toLowerCase())
  return [...datos, ...documentos]
}

// Escala de pagos acordada (en soles). Hoy es fija; pasará a la configuración
// de cada empresa cuando haya un segundo cliente con otra escala.
export const BASICO = { asesor: 1230, supervisor: 1500 }

export function premioAsesor(ventas) {
  return ventas >= 40 ? 3800 : ventas >= 30 ? 1800 : ventas >= 20 ? 800 : ventas >= 15 ? 300 : 0
}

export function bonoSupervisor(ventasZona) {
  return ventasZona >= 60 ? 2000 : ventasZona >= 40 ? 1000 : 0
}

export function pagoJefe(totalZonas, zonasEnMeta) {
  if (totalZonas >= 6) return 3000 + 300 * zonasEnMeta
  if (totalZonas === 5) return 3000 + 400 * zonasEnMeta
  return 2000 + 500 * zonasEnMeta
}

// Estado de avance contra la meta, según la parte del mes ya transcurrida.
export function estadoAvance(valor, meta, avance) {
  if (!meta) return ['neu', 'Sin meta']
  if (valor >= meta) return ['ok', 'Meta cumplida']
  const esperado = meta * avance
  if (esperado < 1) return ['neu', 'Recién empieza']
  if (valor >= esperado * 0.9) return ['ok', 'En ritmo']
  if (valor >= esperado * 0.6) return ['warn', 'Atrasada']
  return ['crit', 'Muy atrasada']
}

export const INTERESES = [
  ['alto', 'Alto'],
  ['medio', 'Medio'],
  ['bajo', 'Bajo'],
]

export const MOTIVOS = [
  ['PRECIO', 'Precio'],
  ['TIEMPO', 'Tiempo'],
  ['CONSULTAR', 'Lo va a consultar'],
  ['OTRA', 'Ya tiene otra'],
  ['DESCONFIANZA', 'Desconfianza'],
]

export const RESULTADOS_CONTACTO = [
  ['RESPONDIO', 'Respondió'],
  ['NO_RESPONDIO', 'No respondió'],
  ['LLAMAR', 'Pidió que lo llame'],
]

export function diasSegunInteres(interes, cfg) {
  if (interes === 'alto') return cfg?.dias_interes_alto ?? 2
  if (interes === 'bajo') return cfg?.dias_interes_bajo ?? 15
  return cfg?.dias_interes_medio ?? 5
}

// Orden de la lista "Hoy": primero quien tiene más probabilidad de cerrar.
export function puntajeProspecto(p, hoy, cfg) {
  let puntos = 0
  if (sinTildes(p.condicion).includes(sinTildes(cfg?.condicion_valida ?? 'NOMBRAD'))) puntos += 40
  puntos += p.interes === 'alto' ? 30 : p.interes === 'medio' ? 15 : 0
  if (p.proximo_contacto && p.proximo_contacto < hoy) puntos += 10
  return puntos
}

// Reglas del negocio que usan el asesor y el panel. Los textos que deciden si
// una venta es válida vienen de la configuración de la empresa.

export function mayus(texto) {
  return String(texto ?? '').trim().toUpperCase()
}

function sinTildes(texto) {
  return mayus(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function titulo(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
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

export function esValida(venta, cfg) {
  if (esCaida(venta)) return false
  const condicion = sinTildes(venta.condicion).includes(sinTildes(cfg?.condicion_valida ?? 'NOMBRAD'))
  const pago = sinTildes(venta.pago).includes(sinTildes(cfg?.pago_valido ?? 'PLANILLA'))
  return condicion && pago
}

export function motivoNoValida(venta, cfg) {
  if (esCaida(venta)) return 'Caída'
  if (!sinTildes(venta.condicion).includes(sinTildes(cfg?.condicion_valida ?? 'NOMBRAD'))) return 'No nombrado'
  return 'Sin planilla'
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
  if (esperado < 1) return ['neu', 'Inicio de mes']
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

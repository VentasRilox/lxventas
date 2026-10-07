import { fechaISOaDate, finDeMes, formatearFechaLocal, mesDe, sumarDias } from './fecha'

// Periodo de venta de una zona. Si la zona tiene fecha de apertura, su "mes"
// corre desde ese día: abre el 9 de octubre → primer periodo del 9 de octubre
// al 9 de noviembre; el siguiente, del 10 de noviembre al 9 de diciembre.
// El primer periodo también cuenta lo registrado antes de abrir (`trae`), para
// no perder las ventas de los días de preparación.
// Sin fecha de apertura, el periodo es el mes calendario.

// Misma fecha, n meses después. Si el mes no tiene ese día, usa su último día.
function sumarMeses(iso, n) {
  const base = fechaISOaDate(iso)
  const destino = new Date(base.getFullYear(), base.getMonth() + n, 1)
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate()
  destino.setDate(Math.min(base.getDate(), ultimo))
  return formatearFechaLocal(destino)
}

// Periodo que contiene `fecha`, corrido `salto` periodos (-1 = el anterior).
export function periodoDe(apertura, fecha, salto = 0) {
  if (!apertura) {
    const mes = mesDe(sumarMeses(`${mesDe(fecha)}-01`, salto))
    return { desde: `${mes}-01`, hasta: finDeMes(mes), trae: `${mes}-01`, primero: false }
  }
  let numero = 1
  while (fecha > sumarMeses(apertura, numero) && numero < 600) numero++
  numero = Math.max(1, numero + salto)
  const desde = numero === 1 ? apertura : sumarDias(sumarMeses(apertura, numero - 1), 1)
  return { desde, hasta: sumarMeses(apertura, numero), trae: numero === 1 ? sumarDias(apertura, -45) : desde, primero: numero === 1 }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

// '2026-10-09' → '9 oct'
export function diaMes(iso) {
  const p = String(iso).split('-').map(Number)
  return `${p[2]} ${MESES[p[1] - 1]}`
}

export function textoPeriodo(periodo) {
  return `${diaMes(periodo.desde)} al ${diaMes(periodo.hasta)}`
}

export function dentroDe(periodo, fecha) {
  return fecha >= (periodo.trae ?? periodo.desde) && fecha <= periodo.hasta
}

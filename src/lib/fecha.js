// Fechas siempre locales ('YYYY-MM-DD'), nunca toISOString: en Perú (UTC−5)
// correría el día después de las 7 pm.
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']

function dos(n) {
  return String(n).padStart(2, '0')
}

export function formatearFechaLocal(fecha) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

export function fechaLocalHoy() {
  return formatearFechaLocal(new Date())
}

export function horaLocalAhora() {
  const d = new Date()
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`
}

export function fechaISOaDate(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function sumarDias(iso, dias) {
  const fecha = fechaISOaDate(iso)
  fecha.setDate(fecha.getDate() + dias)
  return formatearFechaLocal(fecha)
}

export function diasEntre(desdeISO, hastaISO) {
  return Math.round((fechaISOaDate(hastaISO) - fechaISOaDate(desdeISO)) / 86400000)
}

export function diaSemana(iso) {
  return DIAS[fechaISOaDate(iso).getDay()]
}

// '2026-10-05' → '05/10'
export function fechaCorta(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso
}

// '2026-10-05' → '05/10/26' (con el separador que pida el formato del mensaje)
export function fechaMensaje(iso, separador = '/') {
  const p = iso.split('-')
  return [p[2], p[1], p[0].slice(2)].join(separador)
}

// '14:05' → '2:05 PM'
export function horaMensaje(hora) {
  const p = String(hora ?? '').split(':')
  if (p.length < 2) return ''
  const h = Number(p[0])
  return `${h % 12 || 12}:${p[1]} ${h < 12 ? 'AM' : 'PM'}`
}

export function mesDe(iso) {
  return iso.slice(0, 7)
}

export function finDeMes(mes) {
  const [anio, m] = mes.split('-').map(Number)
  return `${mes}-${dos(new Date(anio, m, 0).getDate())}`
}

// Días de lunes a viernes entre dos fechas, ambas incluidas.
export function diasHabiles(desdeISO, hastaISO) {
  const d = fechaISOaDate(desdeISO)
  const fin = fechaISOaDate(hastaISO)
  let n = 0
  for (; d <= fin; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    if (w > 0 && w < 6) n++
  }
  return n
}

export function lunesDe(iso) {
  const d = fechaISOaDate(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return formatearFechaLocal(d)
}

// '14:05' → '2:05 p. m.'
export function horaCorta(hora) {
  const p = String(hora ?? '').split(':')
  if (p.length < 2) return ''
  const h = Number(p[0])
  return `${h % 12 || 12}:${p[1]} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

// Hora local ('HH:MM') de una marca de tiempo del servidor.
export function horaDeMarca(marca) {
  if (!marca) return ''
  const d = new Date(marca)
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`
}

// Minutos entre dos horas 'HH:MM' (positivo si la segunda es posterior).
export function minutosEntre(desde, hasta) {
  const m = (h) => {
    const p = String(h ?? '').split(':').map(Number)
    return p.length < 2 || p.some(Number.isNaN) ? null : p[0] * 60 + p[1]
  }
  const a = m(desde)
  const b = m(hasta)
  return a === null || b === null ? null : b - a
}

// Fecha local ('YYYY-MM-DD') de una marca de tiempo del servidor.
export function fechaDeMarca(marca) {
  return marca ? formatearFechaLocal(new Date(marca)) : ''
}

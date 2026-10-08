// DNI y celular del Perú: solo números y con el largo exacto.
export const LARGO = { dni: 8, celular: 9 }

export function soloDigitos(valor, maximo) {
  return String(valor ?? '').replace(/\D/g, '').slice(0, maximo)
}

// Devuelven '' si está bien o vacío; si no, el mensaje para mostrar.
export function errorDni(valor) {
  const d = soloDigitos(valor, 20)
  if (!d || d.length === LARGO.dni) return ''
  return `El DNI debe tener 8 dígitos: llevas ${d.length}.`
}

export function errorCelular(valor) {
  const d = soloDigitos(valor, 20)
  if (!d) return ''
  if (d[0] !== '9') return 'El celular debe empezar con 9.'
  if (d.length !== LARGO.celular) return `El celular debe tener 9 dígitos: llevas ${d.length}.`
  return ''
}

export const ERROR = { dni: errorDni, celular: errorCelular }

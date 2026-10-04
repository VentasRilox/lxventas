const MENSAJES_ERROR = {
  'Invalid login credentials': 'Usuario o contraseña incorrectos.',
}

export function esErrorDeRed(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const texto = String(error?.message ?? error ?? '')
  return /Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(texto)
}

export function traducirError(error) {
  if (!error) return ''
  const mensaje = MENSAJES_ERROR[error.message]
  if (mensaje) return mensaje
  if (esErrorDeRed(error)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  console.error(error)
  const partes = [error.message, error.details, error.hint].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'Ocurrió un error inesperado. Intenta de nuevo.'
}

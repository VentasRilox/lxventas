// Ubicación del celular en este momento. Nunca falla: si el asesor no da
// permiso o no hay GPS, devuelve null y el registro se guarda sin ubicación.
export function ubicacionActual(esperaMs = 8000) {
  return new Promise((resolver) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolver(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolver(null),
      { enableHighAccuracy: true, timeout: esperaMs, maximumAge: 60000 }
    )
  })
}

export function enlaceMapa(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

import { useEffect, useState } from 'react'

// Avisa cuando se publicó una versión nueva de la app. No recarga sola para
// no borrar un formulario a medio llenar: el usuario toca y se actualiza.
export default function AvisoVersion() {
  const [hayNueva, setHayNueva] = useState(false)

  useEffect(() => {
    let activo = true
    const revisar = async () => {
      try {
        const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!r.ok) return
        const { version } = await r.json()
        if (activo && version && version !== __VERSION__) setHayNueva(true)
      } catch {
        // Sin señal: se revisa de nuevo más tarde.
      }
    }
    revisar()
    const alVolver = () => document.visibilityState === 'visible' && revisar()
    document.addEventListener('visibilitychange', alVolver)
    const cada = setInterval(revisar, 5 * 60 * 1000)
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(cada)
    }
  }, [])

  if (!hayNueva) return null
  return (
    <button type="button" className="aviso aviso--ok aviso--version" onClick={() => window.location.reload()}>
      Hay una versión nueva de la app. Toca aquí para actualizar.
    </button>
  )
}

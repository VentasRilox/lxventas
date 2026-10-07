import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, usuarioACorreo, DOMINIO_USUARIOS } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { useSesion } from '../lib/SesionProvider.jsx'

const CLAVE_DOMINIO = 'lxv_dominio'

export default function Login() {
  const { sesion } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  if (sesion) {
    return <Navigate to="/" replace />
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()
    setError('')
    setEnviando(true)
    // Quien escribe solo su usuario: se prueba primero con el dominio con el
    // que ya se entró en este celular y luego con el general.
    const u = usuario.trim().toLowerCase()
    let recordado = ''
    try {
      recordado = localStorage.getItem(CLAVE_DOMINIO) ?? ''
    } catch {
      recordado = ''
    }
    const correos = u.includes('@') ? [u] : [...new Set([recordado && `${u}@${recordado}`, usuarioACorreo(u)].filter(Boolean))]
    let errorLogin = null
    for (const correo of correos) {
      const r = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
      errorLogin = r.error
      if (!errorLogin) {
        const dominio = correo.split('@')[1]
        try {
          if (dominio && dominio !== DOMINIO_USUARIOS) localStorage.setItem(CLAVE_DOMINIO, dominio)
        } catch {
          // Si no se puede recordar, la próxima vez escribe el correo completo.
        }
        break
      }
    }
    if (errorLogin) {
      setError(traducirError(errorLogin))
      setEnviando(false)
      return
    }
    navigate(location.state?.from ?? '/', { replace: true })
  }

  return (
    <div className="login">
      <form onSubmit={manejarEnvio}>
        <div>
          <p className="login__marca">
            LX <b>Ventas</b>
          </p>
          <p className="muted small">Visitas, ventas y seguimiento del equipo en campo.</p>
        </div>

        <label htmlFor="usuario">
          Usuario o correo
          <input id="usuario" autoComplete="username" placeholder="ej.: oaguilar@marketing.com" autoCapitalize="none" autoCorrect="off" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </label>

        <label htmlFor="contrasena">
          Contraseña
          <input id="contrasena" type="password" autoComplete="current-password" required value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </label>

        {error && (
          <p className="aviso aviso--crit" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

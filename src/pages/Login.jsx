import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, usuarioACorreo } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { useSesion } from '../lib/SesionProvider.jsx'

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
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: usuarioACorreo(usuario),
      password: contrasena,
    })
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
          Usuario
          <input id="usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
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

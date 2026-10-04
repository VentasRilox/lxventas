import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import PantallaEstado from './PantallaEstado.jsx'

function Salir() {
  return (
    <p style={{ marginTop: 16 }}>
      <button type="button" className="btn btn--sec" onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
    </p>
  )
}

export default function RutaProtegida({ roles }) {
  const { sesion, perfil, errorPerfil } = useSesion()
  const location = useLocation()

  if (!sesion) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  if (!perfil) {
    return (
      <PantallaEstado mensaje={errorPerfil ?? 'Tu usuario todavía no tiene un perfil. Pide a tu jefe de ventas que lo cree.'}>
        <Salir />
      </PantallaEstado>
    )
  }
  if (perfil.activo === false) {
    return (
      <PantallaEstado mensaje="Tu cuenta está desactivada. Consulta con tu jefe de ventas.">
        <Salir />
      </PantallaEstado>
    )
  }
  if (roles && !roles.includes(perfil.rol)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

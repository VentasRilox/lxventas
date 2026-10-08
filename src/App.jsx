import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSesion } from './lib/SesionProvider.jsx'
import PantallaEstado from './components/PantallaEstado.jsx'
import RutaProtegida from './components/RutaProtegida.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Hoy from './pages/Hoy.jsx'
import Visita from './pages/Visita.jsx'
import Venta from './pages/Venta.jsx'
import Seguimiento from './pages/Seguimiento.jsx'
import NuevoProspecto from './pages/NuevoProspecto.jsx'
import ImportarProspectos from './pages/ImportarProspectos.jsx'
import Prospecto from './pages/Prospecto.jsx'
import Avance from './pages/Avance.jsx'
import Panel from './pages/Panel.jsx'
import Equipo from './pages/Equipo.jsx'
import Ajustes from './pages/Ajustes.jsx'

function InicioSegunRol() {
  const { rol } = useSesion()
  return <Navigate to={rol === 'asesor' ? '/hoy' : '/panel'} replace />
}

const CAMPO = ['asesor', 'supervisor', 'jefe']
// El supervisor no registra personas ni ventas: eso es del asesor.
const VENDE = ['asesor', 'jefe']

export default function App() {
  const { cargando } = useSesion()

  if (cargando) {
    return <PantallaEstado mensaje="Cargando..." />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RutaProtegida />}>
          <Route path="/" element={<InicioSegunRol />} />

          <Route element={<Layout />}>
            <Route element={<RutaProtegida roles={CAMPO} />}>
              <Route path="/visita" element={<Visita />} />
              <Route path="/seguimiento" element={<Seguimiento />} />
              <Route path="/seguimiento/:id" element={<Prospecto />} />
            </Route>

            <Route element={<RutaProtegida roles={VENDE} />}>
              <Route path="/hoy" element={<Hoy />} />
              <Route path="/venta" element={<Venta />} />
              <Route path="/docente" element={<NuevoProspecto />} />
              <Route path="/seguimiento/nuevo" element={<Navigate to="/docente" replace />} />
              <Route path="/seguimiento/importar" element={<ImportarProspectos />} />
              <Route path="/avance" element={<Avance />} />
            </Route>

            <Route element={<RutaProtegida roles={['supervisor', 'jefe', 'gerencia']} />}>
              <Route path="/panel" element={<Panel />} />
            </Route>

            <Route element={<RutaProtegida roles={['jefe', 'supervisor']} />}>
              <Route path="/equipo" element={<Equipo />} />
            </Route>

            <Route element={<RutaProtegida roles={['jefe']} />}>
              <Route path="/ajustes" element={<Ajustes />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

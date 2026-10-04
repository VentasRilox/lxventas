import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { pendientes, vaciarCola } from '../lib/cola'
import { fechaLocalHoy } from '../lib/fecha'

const ROLES = { asesor: 'Asesor', supervisor: 'Supervisor', jefe: 'Jefe de ventas', gerencia: 'Gerencia' }

function enlaces(rol, contacto) {
  if (rol === 'asesor') return [['/hoy', 'Hoy'], ['/visita', 'Visita'], ['/venta', 'Venta'], ['/seguimiento', contacto + 's'], ['/avance', 'Mi avance']]
  if (rol === 'supervisor') return [['/panel', 'Panel'], ['/seguimiento', contacto + 's'], ['/visita', 'Visita'], ['/venta', 'Venta'], ['/equipo', 'Equipo']]
  if (rol === 'jefe') return [['/panel', 'Panel'], ['/seguimiento', contacto + 's'], ['/venta', 'Venta'], ['/equipo', 'Equipo'], ['/ajustes', 'Ajustes']]
  return [['/panel', 'Panel']]
}

export default function Layout() {
  const { rol, nombre, empresaNombre, perfil, cfg } = useSesion()
  const [porSubir, setPorSubir] = useState(pendientes())
  const [porContactar, setPorContactar] = useState(0)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    const actualizar = () => setPorSubir(pendientes())
    window.addEventListener('lxv-cola', actualizar)
    return () => window.removeEventListener('lxv-cola', actualizar)
  }, [])

  useEffect(() => {
    if (rol === 'gerencia' || rol === 'jefe') return
    let activo = true
    const contar = async () => {
      const { count } = await supabase
        .from('prospectos')
        .select('id', { count: 'exact', head: true })
        .eq('asesor_id', perfil.id)
        .eq('estado', 'abierto')
        .lte('proximo_contacto', fechaLocalHoy())
      if (activo) setPorContactar(count ?? 0)
    }
    contar()
    window.addEventListener('lxv-seguimiento', contar)
    return () => {
      activo = false
      window.removeEventListener('lxv-seguimiento', contar)
    }
  }, [rol, perfil.id])

  const contacto = cfg?.nombre_contacto ?? 'Contacto'

  return (
    <div className="layout">
      <header className="cabecera">
        <div className="cabecera__marca">
          LX <b>Ventas</b>
        </div>
        <div className="cabecera__quien">
          {nombre}
          <span>
            {ROLES[rol] ?? rol} · {empresaNombre}
          </span>
        </div>
        {confirmando ? (
          <button type="button" onClick={() => supabase.auth.signOut()}>
            ¿Salir? Sí
          </button>
        ) : (
          <button type="button" onClick={() => { setConfirmando(true); setTimeout(() => setConfirmando(false), 4000) }}>
            Salir
          </button>
        )}
      </header>

      {porSubir > 0 && (
        <button type="button" className="aviso" style={{ border: 0, borderRadius: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => vaciarCola()}>
          {porSubir === 1 ? '1 registro por subir.' : `${porSubir} registros por subir.`} Se envían solos cuando haya internet. Toca para reintentar.
        </button>
      )}

      <Outlet />

      <nav className="nav">
        <div className="nav__in">
          {enlaces(rol, contacto).map(([ruta, texto]) => (
            <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
              {texto}
              {ruta === '/hoy' && porContactar > 0 && <span className="globo">{porContactar}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

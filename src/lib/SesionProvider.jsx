import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { traducirError } from './errores'
import { vaciarCola } from './cola'

const SesionContext = createContext(undefined)

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [zonas, setZonas] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [errorPerfil, setErrorPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const usuarioIdAnterior = useRef(undefined)

  const cargarEmpresa = useCallback(async () => {
    const [c, z, p] = await Promise.all([
      supabase.from('configuracion').select('*').maybeSingle(),
      supabase.from('zonas').select('*').order('nombre'),
      supabase.from('plantillas').select('*').order('paso'),
    ])
    setCfg(c.data ?? null)
    setZonas(z.data ?? [])
    setPlantillas(p.data ?? [])
  }, [])

  useEffect(() => {
    let activo = true

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      const usuarioId = nuevaSesion?.user.id ?? null
      if (usuarioId === usuarioIdAnterior.current) return
      usuarioIdAnterior.current = usuarioId

      if (!usuarioId) {
        setPerfil(null)
        setErrorPerfil(null)
        setCargando(false)
        return
      }

      setCargando(true)
      // Fuera del callback de auth: consultar dentro de él puede bloquear al cliente.
      setTimeout(async () => {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*, empresas ( nombre )')
          .eq('usuario_id', usuarioId)
          .maybeSingle()
        if (!activo) return
        setPerfil(data ?? null)
        setErrorPerfil(error ? traducirError(error) : null)
        if (data?.activo) {
          await cargarEmpresa()
          vaciarCola()
        }
        if (activo) setCargando(false)
      }, 0)
    })

    const alVolverSenal = () => vaciarCola()
    window.addEventListener('online', alVolverSenal)

    return () => {
      activo = false
      suscripcion.subscription.unsubscribe()
      window.removeEventListener('online', alVolverSenal)
    }
  }, [cargarEmpresa])

  const zona = zonas.find((z) => z.id === perfil?.zona_id) ?? null

  const valor = {
    sesion,
    cargando,
    perfil,
    errorPerfil,
    rol: perfil?.rol ?? null,
    nombre: perfil?.nombre ?? null,
    empresaNombre: perfil?.empresas?.nombre ?? null,
    cfg,
    zonas,
    zona,
    plantillas,
    recargarEmpresa: cargarEmpresa,
  }

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

export function useSesion() {
  const contexto = useContext(SesionContext)
  if (contexto === undefined) {
    throw new Error('useSesion debe usarse dentro de un SesionProvider')
  }
  return contexto
}

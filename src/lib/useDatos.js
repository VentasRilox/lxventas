import { useCallback, useEffect, useState } from 'react'
import { supabase, traerTodo } from './supabase'
import { traducirError } from './errores'

// Visitas y ventas entre dos fechas. El RLS decide qué filas ve cada rol.
export function useRango(desde, hasta) {
  const [estado, setEstado] = useState({ visitas: [], ventas: [], cargando: true, error: '' })

  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: '' }))
    const [vi, ve] = await Promise.all([
      traerTodo(() => supabase.from('visitas').select('*').gte('fecha', desde).lte('fecha', hasta).order('creado_en')),
      traerTodo(() => supabase.from('ventas').select('*').gte('fecha', desde).lte('fecha', hasta).order('creado_en')),
    ])
    const error = vi.error ?? ve.error
    setEstado({ visitas: vi.data ?? [], ventas: ve.data ?? [], cargando: false, error: error ? traducirError(error) : '' })
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { ...estado, recargar: cargar }
}

// Prospectos visibles para el usuario (todos los estados).
export function useProspectos() {
  const [estado, setEstado] = useState({ prospectos: [], cargando: true, error: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await traerTodo(() => supabase.from('prospectos').select('*').order('creado_en', { ascending: false }))
    setEstado({ prospectos: data ?? [], cargando: false, error: error ? traducirError(error) : '' })
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { ...estado, recargar: cargar }
}

// Ventas con la primera mensualidad sin confirmar (de cualquier mes).
export function useCobros() {
  const [estado, setEstado] = useState({ cobros: [], cargando: true, error: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await traerTodo(() =>
      supabase.from('ventas').select('*').neq('cuota_estado', 'confirmada').neq('estado', 'caida').order('fecha')
    )
    setEstado({ cobros: data ?? [], cargando: false, error: error ? traducirError(error) : '' })
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { ...estado, recargar: cargar }
}

// Ingresos y salidas entre dos fechas.
export function useAsistencias(desde, hasta) {
  const [estado, setEstado] = useState({ asistencias: [], cargando: true, error: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await traerTodo(() =>
      supabase.from('asistencias').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha')
    )
    setEstado({ asistencias: data ?? [], cargando: false, error: error ? traducirError(error) : '' })
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { ...estado, recargar: cargar }
}

// Nombre de cada persona del equipo, por su id (para mostrar quién es el asesor).
export function useNombres(activo = true) {
  const [nombres, setNombres] = useState({})
  useEffect(() => {
    if (!activo) return
    let vigente = true
    supabase
      .from('perfiles')
      .select('id, nombre')
      .then(({ data }) => {
        if (vigente && data) setNombres(Object.fromEntries(data.map((p) => [p.id, p.nombre])))
      })
    return () => {
      vigente = false
    }
  }, [activo])
  return nombres
}

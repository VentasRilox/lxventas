import { useCallback, useEffect, useState } from 'react'
import { supabase, traerTodo } from './supabase'
import { traducirError } from './errores'
import { finDeMes } from './fecha'

// Visitas y ventas de un mes. El RLS decide qué filas ve cada rol.
export function useMes(mes) {
  const [estado, setEstado] = useState({ visitas: [], ventas: [], cargando: true, error: '' })

  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: '' }))
    const desde = `${mes}-01`
    const hasta = finDeMes(mes)
    const [vi, ve] = await Promise.all([
      traerTodo(() => supabase.from('visitas').select('*').gte('fecha', desde).lte('fecha', hasta).order('creado_en')),
      traerTodo(() => supabase.from('ventas').select('*').gte('fecha', desde).lte('fecha', hasta).order('creado_en')),
    ])
    const error = vi.error ?? ve.error
    setEstado({ visitas: vi.data ?? [], ventas: ve.data ?? [], cargando: false, error: error ? traducirError(error) : '' })
  }, [mes])

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

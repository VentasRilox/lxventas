import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { fechaDeMarca, fechaLocalHoy } from '../lib/fecha'
import { META_DIA } from '../lib/reglas'

// Meta del día del asesor: personas visitadas, demostraciones y colegios.
// Se llena sola con sus visitas y con las personas que registra.
export default function MetaDelDia() {
  const { perfil, cfg } = useSesion()
  const hoy = fechaLocalHoy()
  const [d, setD] = useState(null)

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      const [vi, pr] = await Promise.all([
        supabase.from('visitas').select('lugar, con_ingreso, contactos').eq('asesor_id', perfil.id).eq('fecha', hoy),
        supabase.from('prospectos').select('creado_en').eq('asesor_id', perfil.id).gte('creado_en', `${hoy}T00:00:00-05:00`),
      ])
      if (!activo) return
      const visitas = vi.data ?? []
      const demostraciones = (pr.data ?? []).filter((p) => fechaDeMarca(p.creado_en) === hoy).length
      const declaradas = visitas.reduce((s, v) => s + (v.contactos ?? 0), 0)
      setD({
        personas: Math.max(declaradas, demostraciones),
        demostraciones,
        colegios: new Set(visitas.filter((v) => v.con_ingreso).map((v) => v.lugar)).size,
      })
    }
    cargar()
    window.addEventListener('lxv-seguimiento', cargar)
    return () => {
      activo = false
      window.removeEventListener('lxv-seguimiento', cargar)
    }
  }, [perfil.id, hoy])

  if (!d) return null

  const contacto = (cfg?.nombre_contacto ?? 'Docente').toLowerCase()
  const colegiosOk = d.colegios >= META_DIA.colegios || d.personas >= META_DIA.personas
  const filas = [
    [`${contacto}s visitados`, d.personas, META_DIA.personas, 'Lo que pones en "atendidos" en cada visita'],
    ['Demostraciones', d.demostraciones, META_DIA.demostraciones, 'Personas que registras con nombre'],
    ['Colegios con ingreso', d.colegios, META_DIA.colegios, colegiosOk && d.colegios < META_DIA.colegios ? `Cumplida: ya visitaste a ${META_DIA.personas} ${contacto}s` : `O ${META_DIA.personas} ${contacto}s en 1 o 2 colegios`],
  ]
  const cumplidas = [d.personas >= META_DIA.personas, d.demostraciones >= META_DIA.demostraciones, colegiosOk].filter(Boolean).length

  return (
    <section className="meta-dia">
      <div className="fila">
        <h2>Tu meta de hoy</h2>
        <span className={`pill ${cumplidas === 3 ? 'ok' : cumplidas ? 'warn' : 'neu'}`}>{cumplidas === 3 ? '¡Cumplida!' : `${cumplidas} de 3`}</span>
      </div>
      {filas.map(([nombre, valor, meta, ayuda], i) => {
        const ok = i === 2 ? colegiosOk : valor >= meta
        const ancho = ok ? 100 : Math.min(100, (valor / meta) * 100)
        return (
          <div key={nombre} className="meta-dia__fila">
            <div className="fila">
              <span>{nombre[0].toUpperCase() + nombre.slice(1)}</span>
              <b>{valor} / {meta}{ok ? ' ✓' : ''}</b>
            </div>
            <div className={`barra barra--fina ${ok ? 'barra--ok' : ''}`}><i style={{ width: ancho + '%' }} /></div>
            <small className="muted">{ok || i === 2 ? ayuda : `Te faltan ${meta - valor}. ${ayuda}.`}</small>
          </div>
        )
      })}
    </section>
  )
}

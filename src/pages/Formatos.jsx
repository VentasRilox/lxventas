import { useEffect, useMemo, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { fechaLocalHoy, lunesDe, sumarDias } from '../lib/fecha'
import { periodoDe } from '../lib/periodo'
import { FORMATOS, generarFormato } from '../lib/formatos'
import { titulo } from '../lib/reglas'
import Chips from '../components/Chips.jsx'

// El asesor (o su supervisor) elige un formato y las fechas, y la app arma el
// PDF con lo que ya se registró. Se descarga o se comparte por WhatsApp.
export default function Formatos() {
  const { perfil, rol, zonas, cfg, empresaNombre } = useSesion()
  const hoy = fechaLocalHoy()
  const propio = rol === 'asesor'
  const [gente, setGente] = useState(propio ? [perfil] : [])
  const [quien, setQuien] = useState(propio ? perfil.id : '')
  const [formato, setFormato] = useState('ipd')
  const [rango, setRango] = useState('hoy')
  const [f, setF] = useState({ desde: hoy, hasta: hoy })
  const [estado, setEstado] = useState(null)
  const [archivo, setArchivo] = useState(null)

  useEffect(() => {
    if (propio) return
    supabase.from('perfiles').select('*').eq('rol', 'asesor').eq('activo', true).order('nombre').then(({ data }) => setGente(data ?? []))
  }, [propio])

  const asesor = gente.find((g) => g.id === quien) ?? null
  const zona = zonas.find((z) => z.id === asesor?.zona_id) ?? null
  const periodo = periodoDe(zona?.fecha_apertura, hoy)
  const RANGOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['periodo', 'Este periodo'], ['otro', 'Otras fechas']]
  const fechas = useMemo(() => {
    if (rango === 'hoy') return { desde: hoy, hasta: hoy }
    if (rango === 'ayer') return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) }
    if (rango === 'semana') return { desde: lunesDe(hoy), hasta: hoy }
    // La planilla va del inicio del mes de venta; el resto incluye lo vendido antes de abrir la UGEL.
    if (rango === 'periodo' && formato === 'planilla') return { desde: periodo.desde <= hoy ? periodo.desde : lunesDe(hoy), hasta: periodo.hasta < hoy ? periodo.hasta : hoy }
    if (rango === 'periodo') return { desde: periodo.primero || periodo.desde > hoy ? periodo.trae : periodo.desde, hasta: periodo.hasta < hoy ? periodo.hasta : hoy }
    return f
  }, [rango, f, hoy, formato, periodo.desde, periodo.hasta, periodo.trae, periodo.primero])
  const malas = !fechas.desde || !fechas.hasta || fechas.desde > fechas.hasta

  function elegirFormato(id) {
    setFormato(id)
    setArchivo(null)
    setEstado(null)
    // La planilla y el reporte de ventas se piden por periodo; el resto, por día.
    if (id === 'planilla' || id === 'ventas') setRango('periodo')
  }

  async function generar() {
    if (!asesor || malas) return
    setEstado(['', 'Armando el formato…'])
    setArchivo(null)
    try {
      const r = await generarFormato({ formato, asesor, zona, ...fechas, cfg, empresa: empresaNombre })
      setArchivo(r)
      setEstado(['ok', r.filas ? `Listo: ${r.filas} ${r.filas === 1 ? 'registro' : 'registros'}.` : 'Listo, pero no hay registros en esas fechas.'])
    } catch (e) {
      setEstado(['crit', 'No se pudo armar el formato: ' + (e?.message ?? 'intenta de nuevo.')])
    }
  }

  function descargar() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(archivo.blob)
    a.download = archivo.nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
  }

  const pdf = archivo ? new File([archivo.blob], archivo.nombre, { type: 'application/pdf' }) : null
  const sePuedeCompartir = Boolean(pdf && navigator.canShare?.({ files: [pdf] }))

  async function compartir() {
    try {
      await navigator.share({ files: [pdf], title: archivo.nombre })
    } catch {
      // El asesor cerró el menú de compartir: no pasa nada.
    }
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>{propio ? 'Mis formatos' : 'Formatos del equipo'}</h1>
      <p className="muted">Elige el formato y las fechas. La app lo llena sola con lo que {propio ? 'registraste' : 'registró el asesor'}.</p>

      {!propio && (
        <label htmlFor="f_asesor">
          Asesor
          <select id="f_asesor" value={quien} onChange={(e) => { setQuien(e.target.value); setArchivo(null); setEstado(null) }}>
            <option value="">Elige un asesor</option>
            {gente.map((g) => (
              <option key={g.id} value={g.id}>{titulo(g.nombre)}</option>
            ))}
          </select>
        </label>
      )}

      <section>
        <h2>1. ¿Qué formato?</h2>
        <ul className="lista">
          {FORMATOS.map((x) => (
            <li key={x.id}>
              <button type="button" className={`item opcion ${formato === x.id ? 'opcion--elegida' : ''}`} aria-pressed={formato === x.id} onClick={() => elegirFormato(x.id)}>
                {x.nombre}
                <small>{x.ayuda}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>2. ¿De qué fechas?</h2>
        <Chips opciones={RANGOS} valor={rango} alCambiar={(v) => { if (v) { setRango(v); setArchivo(null); setEstado(null) } }} />
        {rango === 'otro' && (
          <div className="grid2">
            <label htmlFor="f_desde">
              Desde
              <input id="f_desde" type="date" value={f.desde} max={hoy} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            </label>
            <label htmlFor="f_hasta">
              Hasta
              <input id="f_hasta" type="date" value={f.hasta} max={hoy} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            </label>
          </div>
        )}
        {malas && <p className="aviso">Revisa las fechas: "Desde" no puede ser después de "Hasta".</p>}
      </section>

      {estado && <p className={`aviso ${estado[0] ? 'aviso--' + estado[0] : ''}`}>{estado[1]}</p>}

      {archivo ? (
        <div className="acciones">
          {sePuedeCompartir && (
            <button type="button" className="btn" onClick={compartir}>Compartir (WhatsApp)</button>
          )}
          <button type="button" className={`btn ${sePuedeCompartir ? 'btn--sec' : ''}`} onClick={descargar}>Descargar PDF</button>
          <button type="button" className="enlace" onClick={() => { setArchivo(null); setEstado(null) }}>Armar otro</button>
        </div>
      ) : (
        <button type="button" className="btn" disabled={!asesor || malas || estado?.[1] === 'Armando el formato…'} onClick={generar}>
          {estado?.[1] === 'Armando el formato…' ? 'Armando…' : 'Armar formato'}
        </button>
      )}
    </main>
  )
}

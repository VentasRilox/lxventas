import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fechaCorta, fechaDeMarca, horaLocalAhora } from '../../lib/fecha'
import { META_DIA, bonoSupervisor, titulo } from '../../lib/reglas'

// Avance de hoy: las mismas barras que ve el asesor, por UGEL y por asesor.
// Docentes visitados, demostraciones y colegios del día, más las ventas del mes.

// Parte de la jornada (8:00 am a 5:00 pm) que ya pasó.
function parteDelDia() {
  const [h, m] = horaLocalAhora().split(':').map(Number)
  return Math.min(1, Math.max(0, (h * 60 + m - 8 * 60) / (9 * 60)))
}

// Color del asesor: cumplió, va bien, va avanzando o va bajo según la hora.
function estadoDe(a, parte) {
  if (a.cumplidas === 3) return ['ok', '¡Cumplió!']
  if (parte <= 0) return ['neu', 'Aún no empieza']
  const esperado = META_DIA.personas * parte
  const r = a.personas / Math.max(1, esperado)
  if (r >= 1) return ['ok', 'Va bien']
  if (r >= 0.6) return ['warn', 'Va avanzando']
  return ['crit', 'Va bajo']
}

function Fila({ nombre, valor, meta, ok }) {
  const lleno = ok || valor >= meta
  return (
    <div className="meta-dia__fila">
      <div className="fila">
        <span>{nombre}</span>
        <b>{valor} / {meta}{lleno ? ' ✓' : ''}</b>
      </div>
      <div className={`barra barra--fina ${lleno ? 'barra--ok' : ''}`}><i style={{ width: (lleno ? 100 : Math.min(100, meta ? (valor / meta) * 100 : 0)) + '%' }} /></div>
    </div>
  )
}

// Versión corta para cada asesor: tres barras en una sola fila.
function Mini({ d, contacto }) {
  const items = [[`${contacto}s`, d.personas, META_DIA.personas], ['Demos', d.demostraciones, META_DIA.demostraciones], ['Colegios', d.colegios, META_DIA.colegios, d.colegiosOk]]
  return (
    <div className="tres-mini">
      {items.map(([t, v, m, ok]) => {
        const lleno = ok || v >= m
        return (
          <div key={t}>
            <small className="muted">{t}</small>
            <b>{v}/{m}{lleno ? ' ✓' : ''}</b>
            <div className={`barra barra--fina ${lleno ? 'barra--ok' : ''}`}><i style={{ width: (lleno ? 100 : Math.min(100, (v / m) * 100)) + '%' }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function Tres({ d, n, contacto }) {
  return (
    <>
      <Fila nombre={`${contacto}s visitados`} valor={d.personas} meta={META_DIA.personas * n} />
      <Fila nombre="Demostraciones" valor={d.demostraciones} meta={META_DIA.demostraciones * n} />
      <Fila nombre="Colegios con ingreso" valor={d.colegios} meta={META_DIA.colegios * n} ok={d.colegiosOk} />
    </>
  )
}

// Ventas válidas del mes con marcas en 40 y en la meta (60).
function VentasMes({ val, meta }) {
  const tope = Math.max(meta, 1)
  const marcas = [40, meta].filter((m, i, l) => m > 0 && m <= tope && l.indexOf(m) === i)
  const bono = bonoSupervisor(val)
  return (
    <div className="meta-dia__fila">
      <div className="fila">
        <span>Ventas válidas del mes</span>
        <b>{val} / {meta}{val >= meta ? ' ✓' : ''}</b>
      </div>
      <div className={`barra barra--marcas ${val >= meta ? 'barra--ok' : ''}`}>
        <i style={{ width: Math.min(100, (val / tope) * 100) + '%' }} />
        {marcas.map((m) => <s key={m} style={{ left: (m / tope) * 100 + '%' }} />)}
      </div>
      <div className="marcas">
        {marcas.map((m) => <small key={m} style={{ left: (m / tope) * 100 + '%' }}>{m}</small>)}
      </div>
      <small className="muted">
        {bono ? `Bono del supervisor: S/ ${bono.toLocaleString('en-US')}. ` : ''}
        {val < 40 ? `Faltan ${40 - val} para las 40.` : val < meta ? `Faltan ${meta - val} para las ${meta}.` : 'Meta del mes cumplida.'}
      </small>
    </div>
  )
}

export default function AvanceHoy({ zonas, asesores, hoy, cfg, nombreDe }) {
  const [datos, setDatos] = useState(null)
  const [fallo, setFallo] = useState('')
  const contacto = cfg?.nombre_contacto ?? 'Docente'

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      const [vi, pr] = await Promise.all([
        supabase.from('visitas').select('asesor_id, lugar, con_ingreso, contactos').eq('fecha', hoy),
        supabase.from('prospectos').select('asesor_id, creado_en').gte('creado_en', `${hoy}T00:00:00-05:00`),
      ])
      if (!activo) return
      if (vi.error || pr.error) setFallo('No se pudo traer el avance de hoy. Toca Actualizar.')
      setDatos({ visitas: vi.data ?? [], prospectos: (pr.data ?? []).filter((p) => fechaDeMarca(p.creado_en) === hoy) })
    }
    cargar()
    const t = setInterval(cargar, 120000)
    return () => {
      activo = false
      clearInterval(t)
    }
  }, [hoy])

  if (!datos) return <p className="muted">Cargando el avance de hoy…</p>

  const parte = parteDelDia()
  const delAsesor = (id) => {
    const vs = datos.visitas.filter((v) => v.asesor_id === id)
    const demostraciones = datos.prospectos.filter((p) => p.asesor_id === id).length
    const personas = Math.max(vs.reduce((s, v) => s + (v.contactos ?? 0), 0), demostraciones)
    const colegios = new Set(vs.filter((v) => v.con_ingreso).map((v) => v.lugar)).size
    const colegiosOk = colegios >= META_DIA.colegios || personas >= META_DIA.personas
    const cumplidas = [personas >= META_DIA.personas, demostraciones >= META_DIA.demostraciones, colegiosOk].filter(Boolean).length
    return { personas, demostraciones, colegios, colegiosOk, cumplidas }
  }
  const sumar = (lista) => {
    const s = lista.reduce((t, a) => ({ personas: t.personas + a.personas, demostraciones: t.demostraciones + a.demostraciones, colegios: t.colegios + a.colegios }), { personas: 0, demostraciones: 0, colegios: 0 })
    return { ...s, colegiosOk: lista.length > 0 && lista.every((a) => a.colegiosOk) }
  }

  const activos = asesores.filter((a) => !a.inactivo).map((a) => ({ ...a, hoy: delAsesor(a.id) }))
  const grupos = zonas.map((z) => ({ z, as: activos.filter((a) => a.zona_id === z.id) }))
  const todos = activos.filter((a) => zonas.some((z) => z.id === a.zona_id))
  const total = sumar(todos.map((a) => a.hoy))
  const conteo = { ok: 0, warn: 0, crit: 0 }
  for (const a of todos) {
    const e = estadoDe(a.hoy, parte)[0]
    if (e in conteo) conteo[e]++
  }

  return (
    <>
      {fallo && <p className="aviso aviso--crit">{fallo}</p>}
      {grupos.length > 1 && (
        <section className="tarjeta">
          <div className="fila">
            <h2>Hoy, todas las UGEL</h2>
            <span className="pill neu">{fechaCorta(hoy)} · {horaLocalAhora()}</span>
          </div>
          <Tres d={total} n={todos.length} contacto={contacto} />
          <p className="small">
            <span className="pill ok">{conteo.ok} van bien</span>{' '}
            <span className="pill warn">{conteo.warn} avanzando</span>{' '}
            <span className="pill crit">{conteo.crit} van bajo</span>
          </p>
        </section>
      )}

      <div className="tarjetas">
        {grupos.map(({ z, as }) => (
          <div className="tarjeta" key={z.id}>
            <div className="fila">
              <h3>{titulo(z.nombre)}</h3>
              <span className="small muted">{z.supervisor_id ? `Sup. ${nombreDe(z.supervisor_id)}` : 'Sin supervisor'}</span>
            </div>
            {as.length ? (
              <Tres d={sumar(as.map((a) => a.hoy))} n={as.length} contacto={contacto} />
            ) : (
              <p className="aviso">Sin asesores activos en esta UGEL.</p>
            )}
            <VentasMes val={z.val} meta={z.meta} />
            {as.length > 0 && (
              <ul className="lista avance-asesores">
                {as.map((a) => {
                  const e = estadoDe(a.hoy, parte)
                  return (
                    <li key={a.id}>
                      <div className="avance-asesor">
                        <div className="fila">
                          <b>{titulo(a.nombre)}</b>
                          <span className={`pill ${e[0]}`}>{e[1]}</span>
                        </div>
                        <Mini d={a.hoy} contacto={contacto} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      {grupos.length === 0 && <p className="muted">Todavía no hay UGEL registradas.</p>}
      <p className="small muted">🟢 cumplió o va al ritmo de la hora · 🟡 va avanzando · 🔴 va bajo. Se actualiza solo cada 2 minutos. Las ventas del mes cuentan desde la apertura de cada UGEL.</p>
    </>
  )
}

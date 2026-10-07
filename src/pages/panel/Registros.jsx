import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fechaCorta, fechaDeMarca } from '../../lib/fecha'
import { soles, titulo } from '../../lib/reglas'

const ESTADO = { abierto: ['warn', 'Interesado'], ganado: ['ok', 'Compró'], perdido: ['neu', 'No le interesa'], pausado: ['neu', 'Para marzo'] }

// Todo lo registrado en el periodo: los colegios visitados y las personas con
// las que habló cada asesor.
export default function Registros({ visitas, prospectos, desde, hasta, nombreDe, cfg }) {
  const [ver, setVer] = useState('colegios')
  const [busca, setBusca] = useState('')
  const lugar = cfg?.nombre_lugar ?? 'Lugar'
  const q = busca.trim().toUpperCase()

  const colegios = visitas
    .slice()
    .reverse()
    .filter((v) => !q || v.lugar.includes(q) || nombreDe(v.asesor_id).toUpperCase().includes(q))
  const personas = prospectos
    .filter((p) => {
      const dia = fechaDeMarca(p.creado_en)
      return dia >= desde && dia <= hasta
    })
    .filter((p) => !q || p.nombre.includes(q) || (p.lugar ?? '').includes(q) || nombreDe(p.asesor_id).toUpperCase().includes(q))

  const atendidos = colegios.reduce((s, v) => s + v.contactos, 0)
  const movilidad = colegios.reduce((s, v) => s + v.movilidad_centimos, 0)

  return (
    <section>
      <h2>Registros del periodo</h2>
      <div className="kpis">
        <div className="kpi"><span>{lugar}s visitados</span><b>{colegios.length}</b><small>{colegios.filter((v) => v.con_ingreso).length} con ingreso</small></div>
        <div className="kpi"><span>Atendidos según visitas</span><b>{atendidos}</b><small>Lo que declaró cada asesor</small></div>
        <div className="kpi"><span>Personas registradas</span><b>{personas.length}</b><small>{atendidos > personas.length ? `Faltan registrar ${atendidos - personas.length}` : 'Con nombre y resultado'}</small></div>
        <div className="kpi"><span>Movilidad</span><b>{soles(movilidad)}</b></div>
      </div>

      <div className="tabs">
        <button type="button" className="tab" aria-pressed={ver === 'colegios'} onClick={() => setVer('colegios')}>{lugar}s ({colegios.length})</button>
        <button type="button" className="tab" aria-pressed={ver === 'personas'} onClick={() => setVer('personas')}>Personas ({personas.length})</button>
      </div>
      <input placeholder="Buscar por nombre, colegio o asesor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />

      {ver === 'colegios' ? (
        <ul className="lista">
          {colegios.map((v) => (
            <li key={v.id}>
              <span>
                {v.lugar}
                <small>{[fechaCorta(v.fecha), v.hora, nombreDe(v.asesor_id)].filter(Boolean).join(' · ')}</small>
                <small>
                  {[v.con_ingreso ? `${v.contactos} ${v.contactos === 1 ? 'atendido' : 'atendidos'}` : titulo(v.resultado), `movilidad ${soles(v.movilidad_centimos)}`, v.director && `director: ${titulo(v.director)}`, v.observacion && titulo(v.observacion)].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span className={`pill ${v.con_ingreso ? 'ok' : 'warn'}`}>{v.con_ingreso ? 'Con ingreso' : 'Sin ingreso'}</span>
            </li>
          ))}
          {colegios.length === 0 && <li><span className="muted">No hay visitas registradas en este periodo.</span></li>}
        </ul>
      ) : (
        <ul className="lista">
          {personas.map((p) => (
            <li key={p.id}>
              <Link className="item" to={`/seguimiento/${p.id}`}>
                {titulo(p.nombre)}
                <small>{[titulo(p.puesto), p.lugar, titulo(p.condicion), p.celular].filter(Boolean).join(' · ')}</small>
                <small>{[fechaCorta(fechaDeMarca(p.creado_en)), nombreDe(p.asesor_id), p.estado === 'abierto' && p.proximo_contacto && `llamar el ${fechaCorta(p.proximo_contacto)}`].filter(Boolean).join(' · ')}</small>
              </Link>
              <span className={`pill ${(ESTADO[p.estado] ?? ESTADO.abierto)[0]}`}>{(ESTADO[p.estado] ?? ESTADO.abierto)[1]}</span>
            </li>
          ))}
          {personas.length === 0 && <li><span className="muted">Nadie registrado en este periodo.</span></li>}
        </ul>
      )}
    </section>
  )
}

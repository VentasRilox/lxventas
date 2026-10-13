import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fechaCorta, fechaDeMarca } from '../../lib/fecha'
import { soles, titulo } from '../../lib/reglas'

const ESTADO = { abierto: ['warn', 'Interesado'], ganado: ['ok', 'Compró'], perdido: ['neu', 'No le interesa'], pausado: ['neu', 'Para marzo'] }

// Todo lo registrado en el periodo: los colegios visitados y las personas con
// las que habló cada asesor.
export default function Registros({ visitas: todas, prospectos: todosP, ventas = [], zonas = [], desde, hasta, nombreDe, cfg }) {
  const [ver, setVer] = useState('resumen')
  const [ugel, setUgel] = useState('')
  const visitas = ugel ? todas.filter((v) => v.zona_id === ugel) : todas
  const prospectos = ugel ? todosP.filter((p) => p.zona_id === ugel) : todosP
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

  // Un renglón por colegio: cuántas veces se fue, cuándo, con quién y qué salió.
  const porColegio = Object.values(
    colegios.reduce((m, v) => {
      const o = (m[v.lugar] ??= { lugar: v.lugar, veces: 0, ingreso: 0, atendidos: 0, ultima: '', primera: v.fecha, asesores: new Set(), zona_id: v.zona_id })
      o.veces++
      if (v.con_ingreso) o.ingreso++
      o.atendidos += v.contactos ?? 0
      if (v.fecha > o.ultima) o.ultima = v.fecha
      if (v.fecha < o.primera) o.primera = v.fecha
      o.asesores.add(nombreDe(v.asesor_id))
      return m
    }, {})
  ).sort((a, b) => b.ultima.localeCompare(a.ultima) || a.lugar.localeCompare(b.lugar))
  const ventasDe = (lugarCol) => ventas.filter((v) => v.estado !== 'caida' && (v.lugar ?? '').toUpperCase() === lugarCol.toUpperCase()).length
  const sinIngreso = porColegio.filter((c) => !c.ingreso)

  const atendidos = colegios.reduce((s, v) => s + v.contactos, 0)
  const movilidad = colegios.reduce((s, v) => s + v.movilidad_centimos, 0)

  return (
    <section>
      <h2>Registros del periodo</h2>
      <div className="kpis">
        <div className="kpi"><span>{lugar}s visitados</span><b>{porColegio.length}</b><small>{colegios.length} visitas · {colegios.filter((v) => v.con_ingreso).length} con ingreso</small></div>
        <div className="kpi"><span>Atendidos (declarados)</span><b>{atendidos}</b><small>Número que el asesor escribió en sus visitas</small></div>
        <div className="kpi"><span>Registrados con nombre</span><b>{personas.length}</b><small>{atendidos > personas.length ? `Faltan registrar ${atendidos - personas.length}` : 'Con nombre y resultado'}</small></div>
        <div className="kpi"><span>Movilidad</span><b>{soles(movilidad)}</b></div>
      </div>

      {zonas.length > 1 && (
        <div className="tabs">
          <button type="button" className="tab" aria-pressed={!ugel} onClick={() => setUgel('')}>Todas</button>
          {zonas.map((z) => (
            <button key={z.id} type="button" className="tab" aria-pressed={ugel === z.id} onClick={() => setUgel(z.id)}>{titulo(z.nombre)}</button>
          ))}
        </div>
      )}
      <div className="tabs">
        <button type="button" className="tab" aria-pressed={ver === 'resumen'} onClick={() => setVer('resumen')}>Por {lugar.toLowerCase()} ({porColegio.length})</button>
        <button type="button" className="tab" aria-pressed={ver === 'colegios'} onClick={() => setVer('colegios')}>Cada visita ({colegios.length})</button>
        <button type="button" className="tab" aria-pressed={ver === 'personas'} onClick={() => setVer('personas')}>Personas ({personas.length})</button>
      </div>
      <input placeholder="Buscar por nombre, colegio o asesor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />

      {ver === 'resumen' ? (
        <>
          {sinIngreso.length > 0 && <p className="aviso">{sinIngreso.length} {sinIngreso.length === 1 ? lugar.toLowerCase() : lugar.toLowerCase() + 's'} sin ingreso todavía: conviene volver.</p>}
          <ul className="lista">
            {porColegio.map((c) => (
              <li key={c.lugar}>
                <span>
                  {c.lugar}
                  <small>{c.veces} {c.veces === 1 ? 'visita' : 'visitas'} · última {fechaCorta(c.ultima)}{c.primera !== c.ultima ? ` · 1.ª ${fechaCorta(c.primera)}` : ''}</small>
                  <small>{c.atendidos} docentes · {ventasDe(c.lugar)} ventas · {[...c.asesores].join(', ')}</small>
                </span>
                <span className={`pill ${c.ingreso ? 'ok' : 'warn'}`}>{c.ingreso ? 'Con ingreso' : 'Volver'}</span>
              </li>
            ))}
            {porColegio.length === 0 && <li><span className="muted">No hay visitas registradas en este periodo.</span></li>}
          </ul>
          <p className="small muted">Ventas: las registradas con el mismo nombre de colegio. Usa las flechas de arriba para ver periodos anteriores.</p>
        </>
      ) : ver === 'colegios' ? (
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

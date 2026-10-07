import { useMemo, useState } from 'react'
import { useAsistencias } from '../../lib/useDatos'
import { fechaCorta, horaCorta, horaDeMarca, minutosEntre } from '../../lib/fecha'
import { titulo } from '../../lib/reglas'
import { enlaceMapa } from '../../lib/ubicacion'

// Quién marcó ingreso y salida en un día, y cuántos días lleva cada asesor en
// el periodo. De aquí sale la planilla.
export default function Asistencia({ desde, hasta, diaInicial, asesores, nombreZona, cfg }) {
  const [dia, setDia] = useState(diaInicial)
  const { asistencias, cargando, error, recargar } = useAsistencias(desde, hasta)
  const tolerancia = cfg?.hora_tolerancia ?? '08:15'
  const fecha = dia >= desde && dia <= hasta ? dia : diaInicial

  const { delDia, diasPorAsesor } = useMemo(() => {
    const porAsesor = {}
    const dias = {}
    for (const a of asistencias) {
      if (a.fecha === fecha) porAsesor[a.asesor_id] = a
      if (a.hora_ingreso) dias[a.asesor_id] = (dias[a.asesor_id] ?? 0) + 1
    }
    return { delDia: porAsesor, diasPorAsesor: dias }
  }, [asistencias, fecha])

  const activos = asesores.filter((a) => !a.inactivo)
  const marcaron = activos.filter((a) => delDia[a.id]?.hora_ingreso)
  const tarde = marcaron.filter((a) => (minutosEntre(tolerancia, delDia[a.id].hora_ingreso) ?? 0) > 0)

  return (
    <section>
      <div className="fila" style={{ flexWrap: 'wrap' }}>
        <h2>Asistencia</h2>
        <div className="fila">
          <input type="date" aria-label="Día" style={{ width: 'auto' }} value={fecha} min={desde} max={hasta} onChange={(e) => e.target.value && setDia(e.target.value)} />
          <button type="button" className="btn btn--sec btn--chico" onClick={recargar}>
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      {error && <p className="aviso aviso--crit">{error}</p>}

      <div className="kpis">
        <div className="kpi"><span>Marcaron ingreso</span><b>{marcaron.length} de {activos.length}</b><small>El {fechaCorta(fecha)}</small></div>
        <div className="kpi"><span>Llegaron tarde</span><b>{tarde.length}</b><small>Después de las {horaCorta(tolerancia)}</small></div>
        <div className="kpi"><span>Sin marcar</span><b>{activos.length - marcaron.length}</b></div>
      </div>

      <ul className="lista">
        {activos.map((a) => {
          const r = delDia[a.id]
          const esTarde = r?.hora_ingreso ? (minutosEntre(tolerancia, r.hora_ingreso) ?? 0) > 0 : false
          // Si la marca subió bastante después de la hora anotada, se avisa.
          const subida = r?.creado_en ? horaDeMarca(r.creado_en) : ''
          const desfase = r?.hora_ingreso && subida ? minutosEntre(r.hora_ingreso, subida) : null
          const dias = diasPorAsesor[a.id] ?? 0
          return (
            <li key={a.id} className="apilado">
              <div className="fila">
                <span>
                  {titulo(a.nombre)}
                  <small>{[titulo(nombreZona(a)), `${dias} ${dias === 1 ? 'día' : 'días'} en el periodo`].filter(Boolean).join(' · ')}</small>
                </span>
                <span className={`pill ${!r?.hora_ingreso ? 'crit' : esTarde ? 'warn' : 'ok'}`}>{!r?.hora_ingreso ? 'Sin marcar' : esTarde ? 'Tarde' : 'A tiempo'}</span>
              </div>
              {r?.hora_ingreso && (
                <p className="small">
                  Ingreso <b>{horaCorta(r.hora_ingreso)}</b> · Salida <b>{r.hora_salida ? horaCorta(r.hora_salida) : 'sin marcar'}</b>
                  {' · '}
                  {r.lat_ingreso != null ? (
                    <a href={enlaceMapa(r.lat_ingreso, r.lng_ingreso)} target="_blank" rel="noopener noreferrer">Ver dónde marcó</a>
                  ) : (
                    <span className="muted">sin ubicación</span>
                  )}
                </p>
              )}
              {desfase !== null && desfase > 20 && (
                <p className="aviso small">Marcó {horaCorta(r.hora_ingreso)}, pero el registro subió recién a las {horaCorta(subida)}: puede ser falta de señal, conviene preguntar.</p>
              )}
            </li>
          )
        })}
        {activos.length === 0 && <li><span className="muted">Aún no hay asesores registrados.</span></li>}
      </ul>
      <p className="small muted">Los días del periodo son los que tienen ingreso marcado: son la base para la planilla. Lo marcado no lo puede cambiar el asesor.</p>
    </section>
  )
}

import { useState } from 'react'
import { descargarExcel } from '../lib/excel'
import { fechaLocalHoy } from '../lib/fecha'

// Botón del Panel para bajar los reportes en Excel entre dos fechas.
export default function DescargarExcel({ desde, hasta, perfiles, zonas, cfg, empresa }) {
  const hoy = fechaLocalHoy()
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ desde, hasta: hasta > hoy ? hoy : hasta })
  const [estado, setEstado] = useState(null)
  const malas = !f.desde || !f.hasta || f.desde > f.hasta

  async function bajar() {
    setEstado(['', 'Preparando el archivo…'])
    try {
      const r = await descargarExcel({ ...f, perfiles, zonas, cfg, empresa })
      setEstado(['ok', `Listo. Personas: ${r.personas} · Ventas: ${r.ventas} · Visitas: ${r.visitas}. Revisa tus descargas.`])
    } catch (e) {
      setEstado(['crit', 'No se pudo descargar: ' + (e?.message ?? 'intenta de nuevo.')])
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn--sec btn--chico" onClick={() => { setF({ desde, hasta: hasta > hoy ? hoy : hasta }); setEstado(null); setAbierto(true) }}>
        Descargar Excel
      </button>
    )
  }

  return (
    <div className="seccion excel">
      <div className="fila">
        <h2>Descargar en Excel</h2>
        <button type="button" className="enlace" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>
      <p className="small muted">Un archivo con 5 hojas: IPD, reporte de ventas, interesados, colegios visitados y actividades diarias.</p>
      <div className="grid2">
        <label htmlFor="x_desde">
          Desde
          <input id="x_desde" type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        </label>
        <label htmlFor="x_hasta">
          Hasta
          <input id="x_hasta" type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        </label>
      </div>
      <div className="acciones">
        <button type="button" className="btn btn--sec btn--chico" onClick={() => setF({ desde: hoy, hasta: hoy })}>Solo hoy</button>
        <button type="button" className="btn btn--sec btn--chico" onClick={() => setF({ desde, hasta: hasta > hoy ? hoy : hasta })}>Este periodo</button>
      </div>
      {malas && <p className="aviso">Revisa las fechas: "Desde" no puede ser después de "Hasta".</p>}
      {estado && <p className={`aviso ${estado[0] ? 'aviso--' + estado[0] : ''}`}>{estado[1]}</p>}
      <button type="button" className="btn" disabled={malas || estado?.[1] === 'Preparando el archivo…'} onClick={bajar}>
        Descargar
      </button>
    </div>
  )
}

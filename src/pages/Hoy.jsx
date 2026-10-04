import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { useProspectos } from '../lib/useDatos'
import { diasEntre, fechaCorta, fechaLocalHoy } from '../lib/fecha'
import { puntajeProspecto, titulo } from '../lib/reglas'
import PantallaEstado from '../components/PantallaEstado.jsx'

export default function Hoy() {
  const { cfg, perfil } = useSesion()
  const { prospectos, cargando, error } = useProspectos()
  const hoy = fechaLocalHoy()
  const contacto = (cfg?.nombre_contacto ?? 'Contacto').toLowerCase()

  const { tocan, proximos } = useMemo(() => {
    const mios = prospectos.filter((p) => p.estado === 'abierto' && p.asesor_id === perfil.id && p.proximo_contacto)
    return {
      tocan: mios
        .filter((p) => p.proximo_contacto <= hoy)
        .sort((a, b) => puntajeProspecto(b, hoy, cfg) - puntajeProspecto(a, hoy, cfg) || (a.proximo_contacto < b.proximo_contacto ? -1 : 1)),
      proximos: mios.filter((p) => p.proximo_contacto > hoy).sort((a, b) => (a.proximo_contacto < b.proximo_contacto ? -1 : 1)).slice(0, 10),
    }
  }, [prospectos, perfil.id, hoy, cfg])

  if (cargando) return <PantallaEstado mensaje="Cargando..." />

  return (
    <main className="contenido contenido--angosto">
      <div>
        <h1>{tocan.length ? `Hoy te toca escribir a ${tocan.length} ${contacto}${tocan.length === 1 ? '' : 's'}` : 'Hoy no tienes contactos pendientes'}</h1>
        <p className="muted">Arriba están los que tienen más opción de cerrar: nombrados y con interés alto.</p>
      </div>
      {error && <p className="aviso aviso--crit">{error}</p>}

      <ul className="lista">
        {tocan.map((p) => {
          const atraso = diasEntre(p.proximo_contacto, hoy)
          return (
            <li key={p.id}>
              <Link className="item" to={`/seguimiento/${p.id}`}>
                {titulo(p.nombre)}
                <small>
                  {[p.lugar, titulo(p.condicion), `interés ${p.interes}`, `contacto ${p.paso} de 4`].filter(Boolean).join(' · ')}
                </small>
              </Link>
              <span className={`pill ${atraso > 0 ? 'crit' : 'warn'}`}>{atraso > 0 ? `${atraso} d de atraso` : 'Hoy'}</span>
            </li>
          )
        })}
        {tocan.length === 0 && (
          <li>
            <span className="muted">Cuando registres a un {contacto} interesado, aparecerá aquí el día que toque escribirle.</span>
          </li>
        )}
      </ul>

      <Link to="/seguimiento/nuevo" className="btn">
        Registrar un {contacto} interesado
      </Link>

      {proximos.length > 0 && (
        <section>
          <h2>Los próximos días</h2>
          <ul className="lista">
            {proximos.map((p) => (
              <li key={p.id}>
                <Link className="item" to={`/seguimiento/${p.id}`}>
                  {titulo(p.nombre)}
                  <small>{p.lugar}</small>
                </Link>
                <span className="pill neu">{fechaCorta(p.proximo_contacto)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { useNombres, useProspectos } from '../lib/useDatos'
import { fechaCorta, fechaLocalHoy } from '../lib/fecha'
import { ESTADO_CLIENTE, puedeVender, titulo } from '../lib/reglas'
import PantallaEstado from '../components/PantallaEstado.jsx'

const ESTADOS = [
  ['abierto', 'En seguimiento'],
  ['ganado', 'Compraron'],
  ['pausado', 'Para marzo'],
  ['perdido', 'No compraron'],
]
const PILL = { alto: 'ok', medio: 'warn', bajo: 'neu' }

export default function Seguimiento() {
  const { cfg, rol, perfil } = useSesion()
  const { prospectos, cargando, error } = useProspectos()
  const [estado, setEstado] = useState('abierto')
  const [busca, setBusca] = useState('')
  const hoy = fechaLocalHoy()
  const soloVer = !puedeVender(rol, cfg)
  const verAsesor = rol !== 'asesor'
  const nombres = useNombres(verAsesor)
  const asesorDe = (p) => (p.asesor_id === perfil.id ? 'tuyo' : titulo(nombres[p.asesor_id] ?? 'asesor'))
  const contacto = cfg?.nombre_contacto ?? 'Contacto'

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase()
    return prospectos
      .filter((p) => p.estado === estado)
      .filter((p) => !q || p.nombre.includes(q) || (p.lugar ?? '').includes(q) || (p.celular ?? '').includes(q) || (nombres[p.asesor_id] ?? '').includes(q))
  }, [prospectos, estado, busca, nombres])

  if (cargando) return <PantallaEstado mensaje="Cargando..." />

  return (
    <main className="contenido contenido--angosto">
      <div className="fila">
        <h1>Cartera</h1>
        {!soloVer && (
          <Link to="/docente" className="btn btn--chico">
            Registrar
          </Link>
        )}
      </div>
      {soloVer ? (
        <p className="small muted">Personas que registró tu equipo. Entra a cada una para llamarla o escribirle por WhatsApp. El seguimiento y la venta los hace el asesor.</p>
      ) : (
        <Link to="/seguimiento/importar" className="small">
          Agregar varios de una vez pegando una lista
        </Link>
      )}
      {error && <p className="aviso aviso--crit">{error}</p>}

      <div className="tabs">
        {ESTADOS.map(([v, t]) => (
          <button key={v} type="button" className="tab" aria-pressed={estado === v} onClick={() => setEstado(v)}>
            {t} ({prospectos.filter((p) => p.estado === v).length})
          </button>
        ))}
      </div>
      <input placeholder={verAsesor ? 'Buscar por nombre, celular, lugar o asesor' : 'Buscar por nombre, celular o lugar'} value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />

      <ul className="lista">
        {lista.map((p) => (
          <li key={p.id}>
            <Link className="item" to={`/seguimiento/${p.id}`}>
              {titulo(p.nombre)}
              <small>
                {[p.puesto && p.puesto !== 'DOCENTE' && titulo(p.puesto), p.lugar, titulo(p.condicion), verAsesor && `asesor: ${asesorDe(p)}`].filter(Boolean).join(' · ')}
                {p.estado === 'abierto' && p.proximo_contacto && ` · llamar el ${fechaCorta(p.proximo_contacto)}`}
              </small>
            </Link>
            {p.estado === 'abierto' && p.proximo_contacto && p.proximo_contacto <= hoy ? (
              <span className="pill crit">{p.proximo_contacto < hoy ? 'Atrasado' : 'Hoy'}</span>
            ) : (
              <span className={`pill ${PILL[p.interes]}`}>{ESTADO_CLIENTE[p.interes]}</span>
            )}
          </li>
        ))}
        {lista.length === 0 && (
          <li>
            <span className="muted">
              {estado === 'abierto'
                ? soloVer ? 'Tu equipo aún no tiene personas en seguimiento.' : `Aún no hay ${contacto.toLowerCase()}s en seguimiento. Registra a cada ${contacto.toLowerCase()} con el que hables y marca "Quedó interesado".`
                : 'No hay nadie en esta lista.'}
            </span>
          </li>
        )}
      </ul>
    </main>
  )
}

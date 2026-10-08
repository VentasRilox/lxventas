import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { useNombres, useProspectos } from '../lib/useDatos'
import { diaSemana, diasEntre, fechaCorta, fechaDeMarca, fechaLocalHoy, sumarDias } from '../lib/fecha'
import { ESTADO_CLIENTE, MOTIVOS, puedeVender, titulo } from '../lib/reglas'
import PantallaEstado from '../components/PantallaEstado.jsx'

const ESTADOS = [
  ['abierto', 'En seguimiento'],
  ['ganado', 'Compraron'],
  ['pausado', 'Para marzo'],
  ['perdido', 'No compraron'],
]
const PILL = { alto: 'ok', medio: 'warn', bajo: 'neu' }
const DUDA = Object.fromEntries(MOTIVOS)
const RESULTADO = { RESPONDIO: 'Respondió', NO_RESPONDIO: 'No respondió', LLAMAR: 'Pidió que lo llame', COMPRO: 'Compró', PERDIDO: 'Ya no le interesa', NOTA: 'Nota' }

// Una persona de la cartera con todo lo necesario para decidir sin abrirla.
function Persona({ p, hoy, asesor, extra }) {
  const atraso = p.estado === 'abierto' && p.proximo_contacto ? diasEntre(p.proximo_contacto, hoy) : null
  const llamar =
    p.estado !== 'abierto' || !p.proximo_contacto
      ? ''
      : atraso > 0 ? `atrasado ${atraso} ${atraso === 1 ? 'día' : 'días'}` : atraso === 0 ? 'llamar hoy' : `llamar el ${fechaCorta(p.proximo_contacto)}`
  return (
    <li>
      <Link className="item" to={`/seguimiento/${p.id}`}>
        <span className="persona__nombre">{titulo(p.nombre)}</span>
        <small>{[p.puesto && p.puesto !== 'DOCENTE' && titulo(p.puesto), p.lugar, titulo(p.condicion ?? ''), p.celular].filter(Boolean).join(' · ')}</small>
        <small>
          {[
            p.motivo && `duda: ${(DUDA[p.motivo] ?? titulo(p.motivo)).toLowerCase()}`,
            p.estado === 'abierto' && `contacto ${Math.min(p.paso, 4)} de 4`,
            llamar,
            `registrado ${fechaCorta(fechaDeMarca(p.creado_en))}`,
            asesor && `asesor: ${asesor}`,
          ].filter(Boolean).join(' · ')}
        </small>
        {extra && <small className="persona__extra">{extra}</small>}
        {p.comentario && <small className="persona__nota">“{p.comentario}”</small>}
      </Link>
      {atraso !== null && atraso > 0 ? (
        <span className="pill crit">Atrasado</span>
      ) : p.estado === 'ganado' ? (
        <span className="pill ok">Compró</span>
      ) : (
        <span className={`pill ${PILL[p.interes]}`}>{ESTADO_CLIENTE[p.interes]}</span>
      )}
    </li>
  )
}

export default function Seguimiento() {
  const { cfg, rol, perfil } = useSesion()
  const { prospectos, cargando, error } = useProspectos()
  const hoy = fechaLocalHoy()
  const [vista, setVista] = useState('dia')
  const [dia, setDia] = useState(hoy)
  const [estado, setEstado] = useState('abierto')
  const [busca, setBusca] = useState('')
  const [hechos, setHechos] = useState([])
  const soloVer = !puedeVender(rol, cfg)
  const verAsesor = rol !== 'asesor'
  const nombres = useNombres(verAsesor)
  const asesorDe = (p) => (!verAsesor ? '' : p.asesor_id === perfil.id ? 'tuyo' : titulo(nombres[p.asesor_id] ?? 'asesor'))
  const contacto = cfg?.nombre_contacto ?? 'Contacto'

  // Llamadas y mensajes anotados ese día (lo que el asesor marcó como "qué pasó").
  useEffect(() => {
    if (vista !== 'dia') return
    let activo = true
    supabase
      .from('contactos')
      .select('prospecto_id, resultado, paso, nota')
      .eq('fecha', dia)
      .then(({ data }) => {
        if (activo) setHechos(data ?? [])
      })
    return () => {
      activo = false
    }
  }, [vista, dia])

  const q = busca.trim().toUpperCase()
  const coincide = (p) => !q || p.nombre.includes(q) || (p.lugar ?? '').includes(q) || (p.celular ?? '').includes(q) || (nombres[p.asesor_id] ?? '').includes(q)

  const lista = useMemo(() => prospectos.filter((p) => p.estado === estado).filter(coincide), [prospectos, estado, q, nombres]) // eslint-disable-line react-hooks/exhaustive-deps

  const delDia = useMemo(() => {
    const porId = Object.fromEntries(prospectos.map((p) => [p.id, p]))
    const registrados = prospectos.filter((p) => fechaDeMarca(p.creado_en) === dia).filter(coincide)
    const contactados = {}
    for (const c of hechos) if (porId[c.prospecto_id] && coincide(porId[c.prospecto_id])) contactados[c.prospecto_id] = c
    // Hoy y días que vienen: a quién le toca llamar. Hoy incluye los atrasados.
    const tocaban = prospectos
      .filter((p) => p.estado === 'abierto' && p.proximo_contacto && (dia === hoy ? p.proximo_contacto <= hoy : p.proximo_contacto === dia))
      .filter((p) => !contactados[p.id])
      .filter(coincide)
    return { registrados, contactados: Object.values(contactados).map((c) => [porId[c.prospecto_id], c]), tocaban, porId }
  }, [prospectos, hechos, dia, hoy, q, nombres]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <PantallaEstado mensaje="Cargando..." />

  const nombreDia = dia === hoy ? 'Hoy' : dia === sumarDias(hoy, -1) ? 'Ayer' : dia === sumarDias(hoy, 1) ? 'Mañana' : titulo(diaSemana(dia))
  const vacio = (texto) => (
    <li>
      <span className="muted">{texto}</span>
    </li>
  )

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
      {soloVer && <p className="small muted">Personas que registró tu equipo. Entra a cada una para llamarla o escribirle por WhatsApp. El seguimiento y la venta los hace el asesor.</p>}
      {error && <p className="aviso aviso--crit">{error}</p>}

      <div className="tabs">
        <button type="button" className="tab" aria-pressed={vista === 'dia'} onClick={() => setVista('dia')}>Por día</button>
        <button type="button" className="tab" aria-pressed={vista === 'todos'} onClick={() => setVista('todos')}>Todos</button>
      </div>
      <input placeholder={verAsesor ? 'Buscar por nombre, celular, lugar o asesor' : 'Buscar por nombre, celular o lugar'} value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />

      {vista === 'dia' && (
        <>
          <div className="periodo">
            <button type="button" className="btn btn--sec btn--chico" aria-label="Día anterior" onClick={() => setDia(sumarDias(dia, -1))}>‹</button>
            <div>
              <b>{nombreDia}</b>
              <span>{titulo(diaSemana(dia))} {fechaCorta(dia)}</span>
              {dia !== hoy && (
                <button type="button" className="enlace" onClick={() => setDia(hoy)}>
                  Volver a hoy
                </button>
              )}
            </div>
            <button type="button" className="btn btn--sec btn--chico" aria-label="Día siguiente" onClick={() => setDia(sumarDias(dia, 1))}>›</button>
          </div>

          <div className="kpis kpis--3">
            <div className="kpi"><span>Registrados</span><b>{delDia.registrados.length}</b></div>
            <div className="kpi"><span>Contactados</span><b>{delDia.contactados.length}</b></div>
            <div className="kpi"><span>{dia < hoy ? 'Quedaron sin llamar' : 'Por llamar'}</span><b>{delDia.tocaban.length}</b></div>
          </div>

          <section>
            <h2>Registrados {nombreDia === 'Hoy' ? 'hoy' : 'este día'} ({delDia.registrados.length})</h2>
            <ul className="lista">
              {delDia.registrados.map((p) => (
                <Persona key={p.id} p={p} hoy={hoy} asesor={asesorDe(p)} />
              ))}
              {delDia.registrados.length === 0 && vacio(`Nadie registrado ${dia === hoy ? 'hoy' : 'este día'}.`)}
            </ul>
          </section>

          <section>
            <h2>Contactados ({delDia.contactados.length})</h2>
            <ul className="lista">
              {delDia.contactados.map(([p, c]) => (
                <Persona key={p.id} p={p} hoy={hoy} asesor={asesorDe(p)} extra={`${RESULTADO[c.resultado] ?? titulo(c.resultado)}${c.paso ? ` · contacto ${c.paso}` : ''}${c.nota ? ` · ${c.nota}` : ''}`} />
              ))}
              {delDia.contactados.length === 0 && vacio('No se anotó ninguna llamada ni mensaje este día.')}
            </ul>
          </section>

          {(dia >= hoy || delDia.tocaban.length > 0) && (
            <section>
              <h2>{dia < hoy ? 'Les tocaba y quedaron sin llamar' : dia === hoy ? 'Te toca llamar (incluye atrasados)' : 'Te toca llamar'} ({delDia.tocaban.length})</h2>
              <ul className="lista">
                {delDia.tocaban.map((p) => (
                  <Persona key={p.id} p={p} hoy={hoy} asesor={asesorDe(p)} />
                ))}
                {delDia.tocaban.length === 0 && vacio('Nadie pendiente.')}
              </ul>
            </section>
          )}
        </>
      )}

      {vista === 'todos' && (
        <>
          <div className="tabs">
            {ESTADOS.map(([v, t]) => (
              <button key={v} type="button" className="tab" aria-pressed={estado === v} onClick={() => setEstado(v)}>
                {t} ({prospectos.filter((p) => p.estado === v).length})
              </button>
            ))}
          </div>
          <ul className="lista">
            {lista.map((p) => (
              <Persona key={p.id} p={p} hoy={hoy} asesor={asesorDe(p)} />
            ))}
            {lista.length === 0 &&
              vacio(
                estado === 'abierto'
                  ? soloVer ? 'Tu equipo aún no tiene personas en seguimiento.' : `Aún no hay ${contacto.toLowerCase()}s en seguimiento. Registra a cada ${contacto.toLowerCase()} con el que hables y marca "Quedó interesado".`
                  : 'No hay nadie en esta lista.'
              )}
          </ul>
          {!soloVer && (
            <Link to="/seguimiento/importar" className="small">
              Agregar varios de una vez pegando una lista
            </Link>
          )}
        </>
      )}
    </main>
  )
}

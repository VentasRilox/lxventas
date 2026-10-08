import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { fechaCorta, fechaDeMarca, fechaLocalHoy, sumarDias } from '../lib/fecha'
import { INTERESES, MOTIVOS, RESULTADOS_CONTACTO, diasSegunInteres, puedeVender, titulo } from '../lib/reglas'
import { enlaceWhatsApp, fechaCorteTexto, llenarPlantilla, plantillaPara } from '../lib/mensajes'
import Chips from '../components/Chips.jsx'
import PantallaEstado from '../components/PantallaEstado.jsx'

const ULTIMO_PASO = 4
const MOTIVOS_PERDIDA = [...MOTIVOS, ['NO_RESPONDE', 'Dejó de responder'], ['NO_CALIFICA', 'No califica']]
const TEXTO_RESULTADO = { RESPONDIO: 'Respondió', NO_RESPONDIO: 'No respondió', LLAMAR: 'Pidió que lo llame', COMPRO: 'Compró', PERDIDO: 'Ya no le interesa', NOTA: 'Nota' }

export default function Prospecto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil, cfg, plantillas, rol } = useSesion()
  const soloVer = !puedeVender(rol, cfg)
  const [p, setP] = useState(null)
  const [contactos, setContactos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nota, setNota] = useState('')
  const [texto, setTexto] = useState('')
  const [proxima, setProxima] = useState('')
  const [perdiendo, setPerdiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const hoy = fechaLocalHoy()

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('prospectos').select('*').eq('id', id).maybeSingle(),
      supabase.from('contactos').select('*').eq('prospecto_id', id).order('creado_en', { ascending: false }),
    ])
    setP(a.data ?? null)
    setContactos(b.data ?? [])
    setError(a.error ? traducirError(a.error) : '')
    setCargando(false)
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Mensaje sugerido del paso actual y fecha propuesta para el siguiente.
  useEffect(() => {
    if (!p) return
    // El mensaje 1 agradece la visita "de hoy": solo vale el mismo día del
    // registro. Si ya pasó, se propone el de seguimiento.
    const pasoMensaje = p.paso === 1 && fechaDeMarca(p.creado_en) !== fechaLocalHoy() ? 2 : p.paso
    const plantilla = plantillaPara(plantillas, pasoMensaje, p.motivo)
    setTexto(
      plantilla
        ? llenarPlantilla(plantilla.texto, {
            nombre: titulo(p.nombre),
            asesor: titulo(perfil.nombre),
            firma: cfg?.firma,
            producto: cfg?.producto,
            lugar: titulo(p.lugar),
            fecha_corte: fechaCorteTexto(cfg, fechaLocalHoy()),
          })
        : ''
    )
    // Si ya hay una fecha futura acordada para volver a llamar, se respeta.
    const acordada = p.proximo_contacto && p.proximo_contacto > fechaLocalHoy() ? p.proximo_contacto : null
    setProxima(acordada ?? sumarDias(fechaLocalHoy(), diasSegunInteres(p.interes, cfg)))
  }, [p, plantillas, cfg, perfil.nombre])

  if (cargando) return <PantallaEstado mensaje="Cargando..." />
  if (!p) return <PantallaEstado mensaje={error || 'No se encontró este registro.'} />

  const contacto = cfg?.nombre_contacto ?? 'Contacto'
  const abierto = p.estado === 'abierto'
  const mio = p.asesor_id === perfil.id
  const agradecerHoy = p.paso === 1 && fechaDeMarca(p.creado_en) === hoy

  async function actualizar(cambios) {
    const { error: fallo } = await supabase.from('prospectos').update(cambios).eq('id', p.id)
    if (fallo) {
      setError(traducirError(fallo))
      return false
    }
    window.dispatchEvent(new Event('lxv-seguimiento'))
    return true
  }

  async function registrar(resultado, extra = {}) {
    setGuardando(true)
    setError('')
    const { error: fallo } = await supabase.from('contactos').insert({
      empresa_id: perfil.empresa_id,
      asesor_id: perfil.id,
      prospecto_id: p.id,
      fecha: hoy,
      paso: p.paso,
      resultado,
      nota: nota.trim() || null,
    })
    if (fallo) {
      setError(traducirError(fallo))
      setGuardando(false)
      return
    }

    let cambios
    if (resultado === 'COMPRO') {
      cambios = { ultimo_contacto: hoy }
    } else if (resultado === 'PERDIDO') {
      cambios = { estado: 'perdido', motivo_perdida: extra.motivo, proximo_contacto: null, ultimo_contacto: hoy }
    } else if (resultado === 'NOTA') {
      cambios = {}
    } else if (p.paso >= ULTIMO_PASO) {
      // Se cumplieron los contactos: queda guardado para reactivarlo más adelante.
      cambios = { estado: 'pausado', proximo_contacto: null, ultimo_contacto: hoy }
    } else {
      cambios = { paso: p.paso + 1, proximo_contacto: resultado === 'LLAMAR' ? sumarDias(hoy, 1) : proxima, ultimo_contacto: hoy }
    }
    const ok = Object.keys(cambios).length ? await actualizar(cambios) : true
    setGuardando(false)
    if (!ok) return
    setNota('')
    setPerdiendo(false)
    if (resultado === 'COMPRO') {
      navigate(`/venta?prospecto=${p.id}`)
      return
    }
    cargar()
  }

  return (
    <main className="contenido contenido--angosto">
      <Link to="/seguimiento" className="small">
        ← Volver a la cartera
      </Link>
      <div>
        <h1>{titulo(p.nombre)}</h1>
        <p className="muted">
          {[titulo(p.puesto), p.lugar, titulo(p.condicion), p.celular].filter(Boolean).join(' · ')}
          {p.referido_por && ` · referido por ${titulo(p.referido_por)}`}
        </p>
      </div>
      {error && <p className="aviso aviso--crit">{error}</p>}
      {p.celular && (soloVer || !abierto) && (
        <div className="acciones">
          <a className="btn" href={`tel:+51${p.celular}`}>Llamar</a>
          <a className="btn btn--sec" href={enlaceWhatsApp(`Buenas, ${titulo(p.nombre).split(' ')[0]}. Le saluda ${titulo(perfil.nombre)}${cfg?.firma ? ', de ' + cfg.firma : ''}.`, p.celular)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      )}
      {soloVer && <p className="small muted">{p.celular ? 'Puedes llamar o escribirle para apoyar.' : 'No tiene celular registrado.'} El seguimiento y la venta los registra el asesor.</p>}
      {!abierto && (
        <p className={`aviso ${p.estado === 'ganado' ? 'aviso--ok' : ''}`}>
          {p.estado === 'ganado' && 'Compró.'}
          {p.estado === 'perdido' && `No compró${p.motivo_perdida ? ': ' + (MOTIVOS_PERDIDA.find((m) => m[0] === p.motivo_perdida)?.[1] ?? p.motivo_perdida).toLowerCase() : ''}.`}
          {p.estado === 'pausado' && 'Se cumplieron los contactos. Queda guardado para reactivarlo más adelante.'}
        </p>
      )}

      <section>
        <h2>Interés</h2>
        <Chips opciones={INTERESES} valor={p.interes} disabled={!abierto || soloVer} alCambiar={async (v) => { if (v && (await actualizar({ interes: v }))) cargar() }} />
        <h2>Su duda principal</h2>
        <Chips opciones={MOTIVOS} valor={p.motivo ?? ''} disabled={!abierto || soloVer} alCambiar={async (v) => { if (await actualizar({ motivo: v || null })) cargar() }} />
        {p.comentario && <p className="muted">{p.comentario}</p>}
      </section>

      {abierto && !soloVer && (
        <section>
          <h2>
            Contacto {Math.min(p.paso, ULTIMO_PASO)} de {ULTIMO_PASO}
            {agradecerHoy ? ' · agradecimiento de hoy' : p.proximo_contacto ? (p.proximo_contacto <= hoy ? ' · toca hoy' : ` · toca el ${fechaCorta(p.proximo_contacto)}`) : ''}
          </h2>
          {agradecerHoy && p.proximo_contacto > hoy && (
            <p className="small muted">Envíale hoy el agradecimiento. La llamada que acordaron queda para el {fechaCorta(p.proximo_contacto)}.</p>
          )}
          <label htmlFor="mensaje">
            Mensaje listo (puedes cambiarlo antes de enviar)
            <textarea id="mensaje" style={{ minHeight: 150 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="acciones">
            <a className="btn" href={enlaceWhatsApp(texto, p.celular)} target="_blank" rel="noopener noreferrer">
              WhatsApp a {titulo(p.nombre).split(' ')[0]}
            </a>
            {p.celular && <a className="btn btn--sec" href={`tel:+51${p.celular}`}>Llamar</a>}
          </div>
          {!mio && rol !== 'asesor' && <p className="small muted">Este {contacto.toLowerCase()} es de otro asesor. Si le escribes, queda anotado a tu nombre.</p>}
        </section>
      )}

      {abierto && !soloVer && (
        <section>
          <h2>¿Qué pasó?</h2>
          <label htmlFor="nota">
            Nota (opcional)
            <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: lo decide el viernes" />
          </label>
          {p.paso < ULTIMO_PASO && (
            <label htmlFor="proxima">
              ¿Cuándo lo vuelves a llamar?
              <input id="proxima" type="date" value={proxima} min={hoy} onChange={(e) => setProxima(e.target.value || proxima)} />
            </label>
          )}
          <div className="acciones">
            {RESULTADOS_CONTACTO.map(([v, t]) => (
              <button key={v} type="button" className="btn btn--sec" disabled={guardando} onClick={() => registrar(v)}>
                {t}
              </button>
            ))}
          </div>
          <div className="acciones">
            <button type="button" className="btn" disabled={guardando} onClick={() => registrar('COMPRO')}>
              Compró: registrar la venta
            </button>
            <button type="button" className="btn btn--sec" disabled={guardando} onClick={() => setPerdiendo(true)}>
              Ya no le interesa
            </button>
          </div>
          {perdiendo && (
            <div className="seccion">
              <p className="aviso">Elige el motivo para cerrar este seguimiento.</p>
              <Chips opciones={MOTIVOS_PERDIDA} valor="" alCambiar={(v) => v && registrar('PERDIDO', { motivo: v })} />
            </div>
          )}
        </section>
      )}

      {!abierto && !soloVer && p.estado !== 'ganado' && (
        <button type="button" className="btn btn--sec" onClick={async () => { if (await actualizar({ estado: 'abierto', paso: 2, proximo_contacto: hoy, motivo_perdida: null })) cargar() }}>
          Reactivar el seguimiento
        </button>
      )}

      <section>
        <h2>Historial</h2>
        <ul className="lista">
          {contactos.map((c) => (
            <li key={c.id}>
              <span>
                {TEXTO_RESULTADO[c.resultado] ?? c.resultado}
                <small>
                  {fechaCorta(c.fecha)}
                  {c.paso ? ` · contacto ${c.paso}` : ''}
                  {c.nota ? ` · ${c.nota}` : ''}
                </small>
              </span>
            </li>
          ))}
          {contactos.length === 0 && (
            <li>
              <span className="muted">{soloVer ? 'El asesor aún no anotó ningún contacto.' : 'Aún no hay contactos anotados. Envía el mensaje y marca qué pasó.'}</span>
            </li>
          )}
        </ul>
      </section>
    </main>
  )
}

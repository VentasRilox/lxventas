import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { guardarRegistro } from '../lib/cola'
import { traducirError } from '../lib/errores'
import { fechaCorta, fechaLocalHoy, sumarDias } from '../lib/fecha'
import { INTERESES, MOTIVOS, diasSegunInteres, mayus, titulo } from '../lib/reglas'
import { errorCelular } from '../lib/validar'
import Campo from '../components/Campo.jsx'
import RespuestasDuda from '../components/RespuestasDuda.jsx'
import Chips from '../components/Chips.jsx'

// Un solo lugar para registrar a cada persona con la que habló el asesor.
// Según lo que pasó, sigue a la venta, queda en cartera con fecha para
// volver a llamar, o se anota que no le interesa.
const CLAVE_LUGAR = 'lxv_lugar'
const PUESTOS = ['Docente', 'Director', 'Auxiliar']
const RESULTADOS = [['compro', 'Compró'], ['interesado', 'Quedó interesado'], ['no', 'No le interesa']]
const MOTIVOS_NO = [...MOTIVOS, ['NO_CALIFICA', 'No califica']]

function lugarRecordado() {
  try {
    return sessionStorage.getItem(CLAVE_LUGAR) ?? ''
  } catch {
    return ''
  }
}

function vacio(lugar) {
  return { nombre: '', celular: '', lugar, puesto: 'Docente', condicion: '', resultado: '', interes: 'medio', motivo: '', comentario: '', referido_por: '', volver: '' }
}

export default function NuevoProspecto() {
  const { perfil, cfg } = useSesion()
  const navigate = useNavigate()
  const [parametros] = useSearchParams()
  const [f, setF] = useState(() => vacio(parametros.get('lugar') ?? lugarRecordado()))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)

  const hoy = fechaLocalHoy()
  const lugarNombre = cfg?.nombre_lugar ?? 'Lugar'
  const celular = f.celular.replace(/\D/g, '')
  // La fecha para volver a llamar se propone según el interés; el asesor la cambia si quiere.
  const sugerida = sumarDias(hoy, diasSegunInteres(f.interes, cfg))
  const volver = f.volver || sugerida
  const falta = [
    !mayus(f.nombre) && 'nombre',
    !f.resultado && 'qué pasó',
    f.resultado === 'interesado' && (!celular || errorCelular(celular)) && 'celular de 9 dígitos que empiece con 9, para poder escribirle',
    f.resultado !== 'interesado' && errorCelular(celular) && 'celular de 9 dígitos que empiece con 9',
    f.resultado === 'no' && !f.motivo && 'el motivo',
  ].filter(Boolean)

  function recordarLugar() {
    try {
      sessionStorage.setItem(CLAVE_LUGAR, f.lugar)
    } catch {
      // Sin almacenamiento: el próximo registro empieza con el lugar vacío.
    }
  }

  async function guardar() {
    if (falta.length) return
    setGuardando(true)
    setError('')
    recordarLugar()
    const interesado = f.resultado === 'interesado'
    const fila = {
      empresa_id: perfil.empresa_id,
      asesor_id: perfil.id,
      zona_id: perfil.zona_id,
      idem_key: `${perfil.id}|P|${celular || mayus(f.nombre)}`,
      nombre: mayus(f.nombre),
      celular,
      lugar: mayus(f.lugar),
      puesto: mayus(f.puesto),
      condicion: mayus(f.condicion),
      interes: f.resultado === 'compro' ? 'alto' : f.resultado === 'no' ? 'bajo' : f.interes,
      motivo: interesado ? f.motivo || null : null,
      comentario: f.comentario.trim(),
      referido_por: mayus(f.referido_por),
      estado: f.resultado === 'no' ? 'perdido' : 'abierto',
      motivo_perdida: f.resultado === 'no' ? f.motivo : null,
      paso: 1,
      proximo_contacto: interesado ? volver : null,
      ultimo_contacto: hoy,
    }

    if (f.resultado === 'compro') {
      // Con señal, la venta queda enlazada a esta persona; sin señal, la venta
      // igual se registra con sus datos ya puestos.
      let id = null
      try {
        const r = await supabase.from('prospectos').upsert(fila, { onConflict: 'empresa_id,idem_key' }).select('id').single()
        id = r.data?.id ?? null
      } catch {
        id = null
      }
      setGuardando(false)
      window.dispatchEvent(new Event('lxv-seguimiento'))
      navigate(id ? `/venta?prospecto=${id}` : '/venta', { state: { datos: { nombre: f.nombre, celular, lugar: f.lugar, condicion: f.condicion, desempeno: f.puesto } } })
      return
    }

    const r = await guardarRegistro('prospectos', fila)
    setGuardando(false)
    if (!r.ok) {
      setError('No se guardó: ' + traducirError(r.error))
      return
    }
    window.dispatchEvent(new Event('lxv-seguimiento'))
    setHecho({ id: r.id ?? null, nombre: fila.nombre, interesado, volver, pendiente: Boolean(r.pendiente) })
    setF(vacio(f.lugar))
    window.scrollTo(0, 0)
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>¿Con quién hablaste?</h1>

      {hecho && (
        <div className="aviso aviso--ok seccion">
          <p>
            {titulo(hecho.nombre)} quedó {hecho.interesado ? `en tu cartera. Te avisaré el ${fechaCorta(hecho.volver)} para que lo llames.` : 'anotado como no interesado.'}
            {hecho.pendiente && ' Sin señal: se subirá solo cuando haya internet.'}
          </p>
          {hecho.interesado && hecho.id && (
            <Link className="btn btn--sec btn--chico" to={`/seguimiento/${hecho.id}`}>
              Enviarle ahora el mensaje de agradecimiento
            </Link>
          )}
        </div>
      )}

      <section>
        <h2>1. ¿Quién es?</h2>
        <div className="grid2">
          <Campo etiqueta="Nombre completo" nombre="nombre" f={f} setF={setF} full autoComplete="off" />
          <Campo etiqueta="Celular" nombre="celular" f={f} setF={setF} solo="celular" />
          <Campo etiqueta={`${lugarNombre} (se recuerda)`} nombre="lugar" f={f} setF={setF} autoComplete="off" />
        </div>
        <p className="etiqueta">Puesto</p>
        <Chips opciones={PUESTOS} valor={f.puesto} alCambiar={(v) => setF({ ...f, puesto: v || 'Docente' })} />
        <p className="etiqueta">Condición laboral</p>
        <Chips opciones={['Nombrado', 'Contratado']} valor={f.condicion} alCambiar={(v) => setF({ ...f, condicion: v })} />
      </section>

      <section>
        <h2>2. ¿Qué pasó?</h2>
        <Chips opciones={RESULTADOS} valor={f.resultado} alCambiar={(v) => setF({ ...f, resultado: v, motivo: '' })} />
      </section>

      {f.resultado === 'interesado' && (
        <section>
          <h2>3. ¿Cuándo lo vuelves a llamar?</h2>
          <Chips
            opciones={[[sumarDias(hoy, 1), 'Mañana'], [sumarDias(hoy, 3), 'En 3 días'], [sumarDias(hoy, 7), 'En 7 días'], [sumarDias(hoy, 15), 'En 15 días']]}
            valor={volver}
            alCambiar={(v) => setF({ ...f, volver: v })}
          />
          <Campo etiqueta="U otra fecha" nombre="volver" f={{ volver }} setF={(cambio) => setF((antes) => ({ ...antes, volver: cambio({ volver }).volver }))} type="date" min={hoy} />
          <p className="etiqueta">¿Cómo quedó el cliente?</p>
          <Chips opciones={INTERESES} valor={f.interes} alCambiar={(v) => setF({ ...f, interes: v || 'medio', volver: '' })} />
          <p className="etiqueta">Su duda principal (para elegirle el mensaje)</p>
          <Chips opciones={MOTIVOS} valor={f.motivo} alCambiar={(v) => setF({ ...f, motivo: v })} />
          <RespuestasDuda motivo={f.motivo} />
          <details className="plegable">
            <summary>Agregar comentario o quién lo recomendó</summary>
            <Campo etiqueta="Comentario" nombre="comentario" f={f} setF={setF} area placeholder="Lo que conversaron y lo que quedó pendiente" />
            <Campo etiqueta="¿Quién lo recomendó? (si es referido)" nombre="referido_por" f={f} setF={setF} />
          </details>
        </section>
      )}

      {f.resultado === 'no' && (
        <section>
          <h2>3. ¿Por qué no?</h2>
          <Chips opciones={MOTIVOS_NO} valor={f.motivo} alCambiar={(v) => setF({ ...f, motivo: v })} />
        </section>
      )}

      {f.resultado === 'compro' && <p className="muted small">Al continuar pasas al cierre de venta con estos datos ya puestos. Solo faltará el programa, el DNI y el pago.</p>}

      {f.resultado && falta.length > 0 && <p className="aviso">Falta: {falta.join(', ')}.</p>}
      {error && <p className="aviso aviso--crit">{error}</p>}

      <div className="acciones acciones--fijas">
        <button type="button" className="btn" disabled={guardando || falta.length > 0} onClick={guardar}>
          {guardando ? 'Guardando...' : f.resultado === 'compro' ? 'Continuar con la venta' : 'Guardar'}
        </button>
      </div>
    </main>
  )
}

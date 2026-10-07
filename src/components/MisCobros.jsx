import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { fechaCorta, fechaLocalHoy } from '../lib/fecha'
import { estadoCompromiso, soles, titulo } from '../lib/reglas'
import FormularioPago from './FormularioPago.jsx'

// Ventas del asesor que todavía no tienen la primera mensualidad confirmada.
// Mientras no se confirme, la venta no cuenta para su meta.
export default function MisCobros() {
  const { perfil, cfg } = useSesion()
  const hoy = fechaLocalHoy()
  const [ventas, setVentas] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [moviendo, setMoviendo] = useState(null)
  const [fechaNueva, setFechaNueva] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState('')
  const [vuelta, setVuelta] = useState(0)
  const alerta = cfg?.dias_alerta_cuota ?? 3

  useEffect(() => {
    let activo = true
    supabase
      .from('ventas')
      .select('id, nombre, lugar, fecha, cuota_estado, cuota_nota, cuota_compromiso, cuota_reprogramaciones')
      .eq('asesor_id', perfil.id)
      .neq('cuota_estado', 'confirmada')
      .neq('estado', 'caida')
      .order('fecha')
      .then(({ data }) => {
        if (activo) setVentas(data ?? [])
      })
    return () => {
      activo = false
    }
  }, [perfil.id, vuelta])

  async function reportar(venta, { medio, operacion }) {
    setOcupado(true)
    setFallo('')
    const { error } = await supabase
      .from('ventas')
      .update({
        cuota_estado: 'reportada',
        cuota_medio: medio,
        cuota_operacion: operacion,
        cuota_fecha: hoy,
        cuota_centimos: cfg?.primera_cuota_centimos ?? 13000,
        cuota_nota: null,
      })
      .eq('id', venta.id)
    setOcupado(false)
    if (error) setFallo(traducirError(error))
    else {
      setAbierta(null)
      setVuelta((n) => n + 1)
    }
  }

  async function reprogramar(venta) {
    if (!fechaNueva || fechaNueva < hoy) return
    setOcupado(true)
    setFallo('')
    const { error } = await supabase.from('ventas').update({ cuota_compromiso: fechaNueva }).eq('id', venta.id)
    setOcupado(false)
    if (error) setFallo(traducirError(error))
    else {
      setMoviendo(null)
      setFechaNueva('')
      setVuelta((n) => n + 1)
    }
  }

  if (ventas.length === 0) return null

  const pendientes = ventas.filter((v) => v.cuota_estado === 'pendiente')

  return (
    <section>
      <h2>Primera mensualidad por cobrar</h2>
      <p className="muted small">
        {pendientes.length
          ? `${pendientes.length === 1 ? 'Tienes 1 venta' : `Tienes ${pendientes.length} ventas`} sin pago de ${soles(cfg?.primera_cuota_centimos ?? 13000)}. No cuentan para tu meta hasta que el pago esté confirmado.`
          : 'Tu supervisor está confirmando estos pagos.'}
      </p>
      {fallo && <p className="aviso aviso--crit">{fallo}</p>}
      <ul className="lista">
        {ventas
          .slice()
          .sort((a, b) => ((a.cuota_compromiso ?? a.fecha) < (b.cuota_compromiso ?? b.fecha) ? -1 : 1))
          .map((v) => {
          const reportada = v.cuota_estado === 'reportada'
          const e = estadoCompromiso(v, hoy, alerta)
          return (
            <li key={v.id} className="apilado">
              <div className="fila">
                <span>
                  {titulo(v.nombre)}
                  <small>{[v.lugar, 'vendido el ' + fechaCorta(v.fecha)].filter(Boolean).join(' · ')}</small>
                </span>
                {reportada ? (
                  <span className="pill neu">Por confirmar</span>
                ) : (
                  <span className={`pill ${e.clase}`}>{e.texto}</span>
                )}
              </div>
              {v.cuota_nota && !reportada && <p className="aviso small">Tu supervisor anotó: {v.cuota_nota}</p>}
              {!reportada && abierta !== v.id && moviendo !== v.id && (
                <div className="acciones">
                  <button type="button" className="btn btn--chico" onClick={() => setAbierta(v.id)}>
                    Ya pagó
                  </button>
                  <button type="button" className="btn btn--sec btn--chico" onClick={() => { setMoviendo(v.id); setFechaNueva('') }}>
                    {v.cuota_compromiso ? 'Cambiar fecha' : 'Poner fecha de pago'}
                  </button>
                </div>
              )}
              {moviendo === v.id && (
                <div className="seccion pago">
                  <label>
                    ¿Qué día va a pagar?
                    <input type="date" min={hoy} value={fechaNueva} onChange={(ev) => setFechaNueva(ev.target.value)} />
                  </label>
                  <div className="acciones">
                    <button type="button" className="btn btn--chico" disabled={ocupado || !fechaNueva || fechaNueva < hoy} onClick={() => reprogramar(v)}>
                      {ocupado ? 'Guardando…' : 'Guardar fecha'}
                    </button>
                    <button type="button" className="btn btn--sec btn--chico" disabled={ocupado} onClick={() => setMoviendo(null)}>
                      Cancelar
                    </button>
                  </div>
                  {v.cuota_compromiso && <p className="small muted">Tu supervisor verá que la fecha se cambió.</p>}
                </div>
              )}
              {abierta === v.id && (
                <FormularioPago textoBoton="Avisar pago" ocupado={ocupado} alGuardar={(d) => reportar(v, d)} alCancelar={() => setAbierta(null)} />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

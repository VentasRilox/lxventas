import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { diasEntre, fechaLocalHoy } from '../lib/fecha'
import { soles, titulo } from '../lib/reglas'
import FormularioPago from './FormularioPago.jsx'

// Ventas del asesor que todavía no tienen la primera mensualidad confirmada.
// Mientras no se confirme, la venta no cuenta para su meta.
export default function MisCobros() {
  const { perfil, cfg } = useSesion()
  const hoy = fechaLocalHoy()
  const [ventas, setVentas] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState('')
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let activo = true
    supabase
      .from('ventas')
      .select('id, nombre, lugar, fecha, cuota_estado, cuota_nota')
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

  if (ventas.length === 0) return null

  const pendientes = ventas.filter((v) => v.cuota_estado === 'pendiente')
  const alerta = cfg?.dias_alerta_cuota ?? 3

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
        {ventas.map((v) => {
          const dias = diasEntre(v.fecha, hoy)
          const reportada = v.cuota_estado === 'reportada'
          return (
            <li key={v.id} className="apilado">
              <div className="fila">
                <span>
                  {titulo(v.nombre)}
                  <small>{[v.lugar, dias === 0 ? 'vendido hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`].filter(Boolean).join(' · ')}</small>
                </span>
                {reportada ? (
                  <span className="pill neu">Por confirmar</span>
                ) : (
                  <span className={`pill ${dias >= alerta ? 'crit' : 'warn'}`}>Falta pago</span>
                )}
              </div>
              {v.cuota_nota && !reportada && <p className="aviso small">Tu supervisor anotó: {v.cuota_nota}</p>}
              {!reportada && abierta !== v.id && (
                <button type="button" className="btn btn--sec btn--chico" onClick={() => setAbierta(v.id)}>
                  Ya pagó
                </button>
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

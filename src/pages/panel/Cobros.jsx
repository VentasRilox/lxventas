import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { traducirError } from '../../lib/errores'
import { diasEntre, fechaCorta, fechaLocalHoy } from '../../lib/fecha'
import { cumpleCondiciones, montoCuota, soles, titulo } from '../../lib/reglas'
import { enlaceWhatsApp } from '../../lib/mensajes'
import FormularioPago from '../../components/FormularioPago.jsx'

// Seguimiento de la primera mensualidad. El supervisor ve qué ventas siguen
// sin pago, se lo recuerda al asesor y confirma los pagos que ya entraron.
export default function Cobros({ cobros, recargar, perfiles, nombreDe, cfg, rol }) {
  const hoy = fechaLocalHoy()
  const [abierta, setAbierta] = useState(null)
  const [devolviendo, setDevolviendo] = useState(null)
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState('')
  const puedeEditar = rol === 'supervisor' || rol === 'jefe'
  const alerta = cfg?.dias_alerta_cuota ?? 3
  const contacto = (cfg?.nombre_contacto ?? 'Contacto').toLowerCase()

  const porConfirmar = cobros.filter((v) => v.cuota_estado === 'reportada')
  const pendientes = cobros.filter((v) => v.cuota_estado === 'pendiente').sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const atrasadas = pendientes.filter((v) => diasEntre(v.fecha, hoy) >= alerta)
  const porCobrar = cobros.reduce((s, v) => s + montoCuota(v, cfg), 0)

  async function actualizar(id, cambios) {
    setOcupado(true)
    setFallo('')
    const { error } = await supabase.from('ventas').update(cambios).eq('id', id)
    setOcupado(false)
    if (error) {
      setFallo(traducirError(error))
      return false
    }
    setAbierta(null)
    setDevolviendo(null)
    setNota('')
    recargar()
    return true
  }

  const confirmar = (v, datos) =>
    actualizar(v.id, {
      cuota_estado: 'confirmada',
      cuota_medio: datos?.medio ?? v.cuota_medio,
      cuota_operacion: datos?.operacion ?? v.cuota_operacion,
      cuota_centimos: v.cuota_centimos ?? cfg?.primera_cuota_centimos ?? 13000,
      cuota_fecha: v.cuota_fecha ?? hoy,
      cuota_nota: null,
    })

  const devolver = (v) =>
    actualizar(v.id, { cuota_estado: 'pendiente', cuota_nota: nota.trim() || 'El pago no figura. Revisa con el ' + contacto + '.' })

  function textoRecordatorio(v) {
    const dias = diasEntre(v.fecha, hoy)
    return [
      `Hola, ${titulo(nombreDe(v.asesor_id)).split(' ')[0]}.`,
      `La venta de ${titulo(v.nombre)}${v.lugar ? ' (' + v.lugar + ')' : ''} del ${fechaCorta(v.fecha)} sigue sin la primera mensualidad de ${soles(montoCuota(v, cfg))}.`,
      dias > 0 ? `Ya van ${dias} ${dias === 1 ? 'día' : 'días'}.` : '',
      '¿Cuándo paga? Recuerda que sin ese pago la venta no cuenta para tu meta.',
    ].filter(Boolean).join(' ')
  }

  const telefonoDe = (id) => perfiles.find((p) => p.id === id)?.telefono ?? ''

  return (
    <>
      <section>
        <h2>Primera mensualidad</h2>
        <div className="kpis">
          <div className="kpi"><span>Por confirmar</span><b>{porConfirmar.length}</b><small>El asesor avisó que ya pagó</small></div>
          <div className="kpi"><span>Sin pagar</span><b>{pendientes.length}</b><small>{atrasadas.length} con {alerta} días o más</small></div>
          <div className="kpi"><span>Por entrar a caja</span><b>{soles(porCobrar)}</b><small>Si se cobra todo lo pendiente</small></div>
        </div>
        {fallo && <p className="aviso aviso--crit">{fallo}</p>}
      </section>

      <section>
        <h2>Por confirmar</h2>
        <p className="small muted">Revisa que el pago figure en el Yape o la cuenta de la empresa y confírmalo. Desde ahí la venta es válida.</p>
        <ul className="lista">
          {porConfirmar.map((v) => (
            <li key={v.id} className="apilado">
              <div className="fila">
                <span>
                  {titulo(v.nombre)}
                  <small>{[nombreDe(v.asesor_id), v.lugar, 'vendido el ' + fechaCorta(v.fecha)].filter(Boolean).join(' · ')}</small>
                  <small>
                    {[titulo(v.cuota_medio), v.cuota_operacion ? 'operación ' + v.cuota_operacion : 'sin n.° de operación', soles(montoCuota(v, cfg))].filter(Boolean).join(' · ')}
                  </small>
                </span>
                {!cumpleCondiciones(v, cfg) && <span className="pill warn">Por revisar</span>}
              </div>
              {puedeEditar && devolviendo !== v.id && (
                <div className="acciones">
                  <button type="button" className="btn btn--chico" disabled={ocupado} onClick={() => confirmar(v)}>
                    Confirmar pago
                  </button>
                  <button type="button" className="btn btn--sec btn--chico" disabled={ocupado} onClick={() => { setDevolviendo(v.id); setNota('') }}>
                    No figura
                  </button>
                </div>
              )}
              {devolviendo === v.id && (
                <div className="seccion pago">
                  <label>
                    Mensaje para el asesor
                    <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={'El pago no figura. Revisa con el ' + contacto + '.'} />
                  </label>
                  <div className="acciones">
                    <button type="button" className="btn btn--peligro btn--chico" disabled={ocupado} onClick={() => devolver(v)}>
                      Devolver a "sin pagar"
                    </button>
                    <button type="button" className="btn btn--sec btn--chico" disabled={ocupado} onClick={() => setDevolviendo(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {porConfirmar.length === 0 && <li><span className="muted">Ningún pago esperando confirmación.</span></li>}
        </ul>
      </section>

      <section>
        <h2>Sin pagar</h2>
        <p className="small muted">Primero las más antiguas. Recuérdaselo al asesor: él es quien cobra al {contacto}.</p>
        <ul className="lista">
          {pendientes.map((v) => {
            const dias = diasEntre(v.fecha, hoy)
            const telefono = telefonoDe(v.asesor_id)
            const recordado = v.cuota_recordada_en ? fechaCorta(String(v.cuota_recordada_en).slice(0, 10)) : ''
            return (
              <li key={v.id} className="apilado">
                <div className="fila">
                  <span>
                    {titulo(v.nombre)}
                    <small>{[nombreDe(v.asesor_id), v.lugar, v.celular ? 'cel. ' + v.celular : ''].filter(Boolean).join(' · ')}</small>
                    {v.cuota_nota && <small>Nota: {v.cuota_nota}</small>}
                    {!cumpleCondiciones(v, cfg) && <small>Ojo: no es nombrado con planilla. Aunque pague, queda por revisar.</small>}
                    {recordado && <small>Recordado al asesor el {recordado}</small>}
                  </span>
                  <span className={`pill ${dias >= alerta ? 'crit' : 'warn'}`}>{dias === 0 ? 'Hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`}</span>
                </div>
                {puedeEditar && abierta !== v.id && (
                  <div className="acciones">
                    {telefono ? (
                      <a
                        className="btn btn--sec btn--chico"
                        href={enlaceWhatsApp(textoRecordatorio(v), telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { supabase.from('ventas').update({ cuota_recordada_en: new Date().toISOString() }).eq('id', v.id).then(() => recargar()) }}
                      >
                        Recordar al asesor
                      </a>
                    ) : (
                      <span className="small muted">El asesor no tiene celular registrado (agrégalo en Equipo).</span>
                    )}
                    <button type="button" className="btn btn--chico" disabled={ocupado} onClick={() => setAbierta(v.id)}>
                      Ya pagó
                    </button>
                  </div>
                )}
                {abierta === v.id && (
                  <FormularioPago textoBoton="Confirmar pago" ocupado={ocupado} alGuardar={(d) => confirmar(v, d)} alCancelar={() => setAbierta(null)} />
                )}
              </li>
            )
          })}
          {pendientes.length === 0 && <li><span className="muted">Todas las ventas tienen su primera mensualidad pagada o por confirmar.</span></li>}
        </ul>
      </section>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { enCola, guardarRegistro } from '../lib/cola'
import { esErrorDeRed, traducirError } from '../lib/errores'
import { fechaLocalHoy, horaCorta, horaLocalAhora, minutosEntre } from '../lib/fecha'
import { ubicacionActual } from '../lib/ubicacion'

// Tarjeta "Mi jornada": un botón para marcar el ingreso y otro para la salida.
// Guarda la hora y la ubicación del celular. Lo marcado ya no se cambia.
export default function Jornada() {
  const { perfil, cfg } = useSesion()
  const hoy = fechaLocalHoy()
  const [registro, setRegistro] = useState(null)
  const [cargado, setCargado] = useState(false)
  const [marcando, setMarcando] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [aviso, setAviso] = useState(null)

  const idemKey = `${perfil.id}|A|${hoy}`

  // Lo que diga la base; si aún no subió por falta de señal, lo que está en cola.
  useEffect(() => {
    let activo = true
    const leer = async () => {
      let data = null
      let error = null
      try {
        const r = await supabase.from('asistencias').select('*').eq('asesor_id', perfil.id).eq('fecha', hoy).maybeSingle()
        data = r.data
        error = r.error
      } catch (e) {
        error = e
      }
      if (!activo) return
      if (error && !esErrorDeRed(error)) {
        setAviso(['crit', traducirError(error)])
        return
      }
      setRegistro(data ?? enCola('asistencias', idemKey))
      setCargado(true)
    }
    leer()
    return () => {
      activo = false
    }
  }, [perfil.id, hoy, idemKey])

  async function marcar(tipo) {
    setMarcando(tipo)
    setAviso(null)
    const hora = horaLocalAhora()
    const lugar = await ubicacionActual()
    const base = registro ?? {}
    const fila = {
      empresa_id: perfil.empresa_id,
      asesor_id: perfil.id,
      zona_id: perfil.zona_id,
      idem_key: idemKey,
      fecha: hoy,
      hora_ingreso: base.hora_ingreso ?? hora,
      lat_ingreso: base.hora_ingreso ? base.lat_ingreso ?? null : lugar?.lat ?? null,
      lng_ingreso: base.hora_ingreso ? base.lng_ingreso ?? null : lugar?.lng ?? null,
    }
    if (tipo === 'salida') {
      fila.hora_salida = hora
      fila.lat_salida = lugar?.lat ?? null
      fila.lng_salida = lugar?.lng ?? null
    }
    const r = await guardarRegistro('asistencias', fila)
    setMarcando('')
    setConfirmar(false)
    if (!r.ok) {
      setAviso(['crit', 'No se guardó: ' + traducirError(r.error)])
      return
    }
    setRegistro({ ...base, ...fila })
    const partes = [tipo === 'salida' ? 'Salida marcada.' : 'Ingreso marcado.']
    if (!lugar) partes.push('No se pudo leer tu ubicación: activa el GPS y da permiso para la próxima vez.')
    if (r.pendiente) partes.push('Sin señal: se subirá sola cuando haya internet.')
    setAviso([lugar && !r.pendiente ? 'ok' : 'warn', partes.join(' ')])
  }

  const tolerancia = cfg?.hora_tolerancia ?? '08:15'
  const tarde = registro?.hora_ingreso ? (minutosEntre(tolerancia, registro.hora_ingreso) ?? 0) > 0 : false

  return (
    <section className="tarjeta">
      <div className="fila">
        <h2>Mi jornada de hoy</h2>
        {registro?.hora_ingreso && <span className={`pill ${tarde ? 'warn' : 'ok'}`}>{tarde ? 'Ingreso tarde' : 'A tiempo'}</span>}
      </div>

      {registro?.hora_ingreso ? (
        <div className="jornada">
          <div>
            <span>Ingreso</span>
            <b>{horaCorta(registro.hora_ingreso)}</b>
          </div>
          <div>
            <span>Salida</span>
            <b>{registro.hora_salida ? horaCorta(registro.hora_salida) : '—'}</b>
          </div>
        </div>
      ) : (
        <p className="muted small">Marca tu ingreso al llegar al punto de encuentro. Se guarda la hora y tu ubicación.</p>
      )}

      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}

      {cargado && !registro?.hora_ingreso && (
        <button type="button" className="btn btn--grande" disabled={marcando !== ''} onClick={() => marcar('ingreso')}>
          {marcando ? 'Marcando…' : 'Marcar ingreso'}
        </button>
      )}
      {registro?.hora_ingreso && !registro.hora_salida && (
        confirmar ? (
          <div className="acciones">
            <button type="button" className="btn" disabled={marcando !== ''} onClick={() => marcar('salida')}>
              {marcando ? 'Marcando…' : 'Sí, marcar salida'}
            </button>
            <button type="button" className="btn btn--sec" disabled={marcando !== ''} onClick={() => setConfirmar(false)}>
              Todavía no
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--sec" onClick={() => setConfirmar(true)}>
            Marcar salida
          </button>
        )
      )}
      {registro?.hora_salida && <p className="muted small">Jornada cerrada. Hasta mañana.</p>}
    </section>
  )
}

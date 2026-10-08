import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { MOTIVOS } from '../lib/reglas'
import { RESPUESTAS_BASE } from '../lib/respuestas'
import Campo from '../components/Campo.jsx'

const PASOS = { 1: 'Contacto 1 · el mismo día', 2: 'Contacto 2', 3: 'Contacto 3', 4: 'Contacto 4 · fecha límite', 9: 'Al cerrar la venta' }

export default function Ajustes() {
  const { cfg, plantillas, recargarEmpresa } = useSesion()
  const [f, setF] = useState(null)
  const [textos, setTextos] = useState({})
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (cfg && !f) {
      const resp = Object.fromEntries(MOTIVOS.map(([m]) => [m, ((Array.isArray(cfg.respuestas?.[m]) && cfg.respuestas[m].length ? cfg.respuestas[m] : RESPUESTAS_BASE[m]) ?? []).join('\n')]))
      setF({ ...cfg, resp, valor_venta: String((cfg.valor_venta_centimos ?? 0) / 100), primera_cuota: String((cfg.primera_cuota_centimos ?? 13000) / 100), dia_corte_planilla: cfg.dia_corte_planilla ?? '' })
    }
  }, [cfg, f])

  useEffect(() => {
    setTextos(Object.fromEntries(plantillas.map((p) => [p.id, p.texto])))
  }, [plantillas])

  if (!f) return null

  const entero = (v, base) => {
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? base : n
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setAviso(null)
    const corte = entero(f.dia_corte_planilla, null)
    const { error } = await supabase
      .from('configuracion')
      .update({
        producto: f.producto.trim(),
        firma: f.firma.trim(),
        nombre_zona: f.nombre_zona.trim() || 'Zona',
        nombre_lugar: f.nombre_lugar.trim() || 'Lugar',
        nombre_contacto: f.nombre_contacto.trim() || 'Contacto',
        valor_venta_centimos: Math.round((parseFloat(f.valor_venta) || 0) * 100),
        meta_semanal_zona: entero(f.meta_semanal_zona, 15),
        dias_interes_alto: entero(f.dias_interes_alto, 2),
        dias_interes_medio: entero(f.dias_interes_medio, 5),
        dias_interes_bajo: entero(f.dias_interes_bajo, 15),
        dias_escalar_supervisor: entero(f.dias_escalar_supervisor, 7),
        dia_corte_planilla: corte && corte >= 1 && corte <= 31 ? corte : null,
        primera_cuota_centimos: Math.round((parseFloat(f.primera_cuota) || 0) * 100),
        hora_tolerancia: /^\d{2}:\d{2}$/.test(f.hora_tolerancia ?? '') ? f.hora_tolerancia : '08:15',
        dias_alerta_cuota: entero(f.dias_alerta_cuota, 3),
        ...('respuestas' in cfg ? { respuestas: Object.fromEntries(MOTIVOS.map(([m]) => [m, String(f.resp?.[m] ?? '').split('\n').map((l) => l.trim()).filter(Boolean)])) } : {}),
        ...('supervisor_registra' in cfg ? { supervisor_registra: Boolean(f.supervisor_registra) } : {}),
        dominio_correo: String(f.dominio_correo ?? '').trim().toLowerCase().replace(/^@/, '') || null,
      })
      .eq('empresa_id', cfg.empresa_id)
    let fallo = error
    for (const p of plantillas) {
      if (fallo) break
      if (textos[p.id] !== p.texto) {
        const r = await supabase.from('plantillas').update({ texto: textos[p.id] }).eq('id', p.id)
        fallo = r.error
      }
    }
    setGuardando(false)
    setAviso(fallo ? ['crit', traducirError(fallo)] : ['ok', 'Cambios guardados.'])
    if (!fallo) recargarEmpresa()
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>Ajustes</h1>
      <form className="seccion" onSubmit={guardar}>
        <h2>Lo que se vende</h2>
        <div className="grid2">
          <Campo etiqueta="Nombre del producto (sale en los mensajes)" nombre="producto" f={f} setF={setF} full />
          <Campo etiqueta="Firma de la empresa (sale en los mensajes)" nombre="firma" f={f} setF={setF} full />
          <Campo etiqueta="Valor de una venta (S/)" nombre="valor_venta" f={f} setF={setF} inputMode="decimal" />
          <Campo etiqueta="Día de corte de planilla (1 a 31)" nombre="dia_corte_planilla" f={f} setF={setF} inputMode="numeric" placeholder="Sin definir" />
        </div>

        <h2>Primera mensualidad y jornada</h2>
        <div className="grid2">
          <Campo etiqueta="Primera mensualidad (S/)" nombre="primera_cuota" f={f} setF={setF} inputMode="decimal" />
          <Campo etiqueta="Días sin pago para alertar" nombre="dias_alerta_cuota" f={f} setF={setF} inputMode="numeric" />
          <Campo etiqueta="Ingreso a tiempo hasta las" nombre="hora_tolerancia" f={f} setF={setF} type="time" />
        </div>

        <h2>Accesos del equipo</h2>
        <Campo etiqueta="Dominio de los correos (ej.: marketing.com)" nombre="dominio_correo" f={f} setF={setF} autoCapitalize="none" autoComplete="off" placeholder="lxventas.com" />
        <p className="small muted">Los accesos nuevos se crean como usuario@dominio. Los que ya existen no cambian.</p>

        {'supervisor_registra' in cfg && (
          <>
            <h2>Supervisores</h2>
            <label className="casilla" htmlFor="c_supervisor_registra">
              <input id="c_supervisor_registra" type="checkbox" checked={Boolean(f.supervisor_registra)} onChange={(e) => setF({ ...f, supervisor_registra: e.target.checked })} />
              <span>El supervisor también puede registrar personas y ventas</span>
            </label>
            <p className="small muted">Apagado: el supervisor solo visita colegios, revisa a su equipo y puede llamar o escribir. Enciéndelo cuando lo necesites y guarda.</p>
          </>
        )}

        <h2>Cómo llama tu empresa a cada cosa</h2>
        <div className="grid2">
          <Campo etiqueta="Zona de venta" nombre="nombre_zona" f={f} setF={setF} />
          <Campo etiqueta="Lugar que se visita" nombre="nombre_lugar" f={f} setF={setF} />
          <Campo etiqueta="Persona a la que se vende" nombre="nombre_contacto" f={f} setF={setF} />
          <Campo etiqueta="Meta semanal por zona" nombre="meta_semanal_zona" f={f} setF={setF} inputMode="numeric" />
        </div>

        <h2>Días hasta el siguiente contacto</h2>
        <div className="grid2">
          <Campo etiqueta="Cliente caliente" nombre="dias_interes_alto" f={f} setF={setF} inputMode="numeric" />
          <Campo etiqueta="Cliente tibio" nombre="dias_interes_medio" f={f} setF={setF} inputMode="numeric" />
          <Campo etiqueta="Cliente frío" nombre="dias_interes_bajo" f={f} setF={setF} inputMode="numeric" />
          <Campo etiqueta="Días para avisar al supervisor" nombre="dias_escalar_supervisor" f={f} setF={setF} inputMode="numeric" />
        </div>

        {'respuestas' in cfg && (
          <>
            <h2>Qué responder ante cada duda</h2>
            <p className="small muted">El asesor las ve al marcar la duda del {String(f.nombre_contacto || 'docente').toLowerCase()}. Una respuesta por línea. Escribe solo lo que sea cierto de tu producto. {'{cuota}'} pone el monto de la primera mensualidad.</p>
            {MOTIVOS.map(([m, t]) => (
              <label key={m} htmlFor={'r_' + m}>
                Si su duda es: {t.toLowerCase()}
                <textarea id={'r_' + m} style={{ minHeight: 110 }} value={f.resp?.[m] ?? ''} onChange={(e) => setF({ ...f, resp: { ...f.resp, [m]: e.target.value } })} />
              </label>
            ))}
          </>
        )}

        <h2>Mensajes de seguimiento</h2>
        <p className="small muted">
          Se llenan solos: {'{nombre}'}, {'{asesor}'}, {'{firma}'}, {'{producto}'}, {'{lugar}'} y {'{fecha_corte}'}. Escribe solo lo que sea cierto de tu producto.
        </p>
        {plantillas.map((p) => (
          <label key={p.id} htmlFor={'pl_' + p.id}>
            {PASOS[p.paso] ?? `Contacto ${p.paso}`}
            {p.motivo ? ` · si su duda es: ${(MOTIVOS.find((m) => m[0] === p.motivo)?.[1] ?? p.motivo).toLowerCase()}` : ''}
            <textarea id={'pl_' + p.id} style={{ minHeight: 120 }} value={textos[p.id] ?? ''} onChange={(e) => setTextos({ ...textos, [p.id]: e.target.value })} />
          </label>
        ))}

        {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}
        <button type="submit" className="btn" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
      </form>
    </main>
  )
}

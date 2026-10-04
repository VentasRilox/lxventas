import { useMemo, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { useMes } from '../lib/useDatos'
import { traducirError } from '../lib/errores'
import { diaSemana, diasHabiles, fechaCorta, fechaLocalHoy, fechaMensaje, finDeMes, mesDe } from '../lib/fecha'
import { esValida, mayus, soles, titulo } from '../lib/reglas'
import { enlaceWhatsApp } from '../lib/mensajes'
import PantallaEstado from '../components/PantallaEstado.jsx'

export default function Avance() {
  const { perfil, cfg } = useSesion()
  const hoy = fechaLocalHoy()
  const mes = mesDe(hoy)
  const { visitas, ventas, cargando, error, recargar } = useMes(mes)
  const [quitando, setQuitando] = useState(null)
  const [fallo, setFallo] = useState('')

  const r = useMemo(() => {
    const misVisitas = visitas.filter((v) => v.asesor_id === perfil.id)
    const misVentas = ventas.filter((v) => v.asesor_id === perfil.id)
    const validas = misVentas.filter((v) => esValida(v, cfg))
    const hoyVis = misVisitas.filter((v) => v.fecha === hoy)
    const ultima = {}
    for (const v of misVisitas) ultima[v.lugar] = v
    return {
      validas: validas.length,
      porRevisar: misVentas.filter((v) => v.estado !== 'caida' && !esValida(v, cfg)).length,
      ventasHoy: misVentas.filter((v) => v.fecha === hoy),
      ventasMes: misVentas.slice().reverse(),
      hoyVis,
      ingresos: hoyVis.filter((v) => v.con_ingreso).length,
      contactos: hoyVis.reduce((s, v) => s + v.contactos, 0),
      movilidad: hoyVis.reduce((s, v) => s + v.movilidad_centimos, 0),
      volver: Object.values(ultima).filter((v) => !v.con_ingreso),
    }
  }, [visitas, ventas, perfil.id, cfg, hoy])

  if (cargando) return <PantallaEstado mensaje="Cargando..." />

  const meta = perfil.meta_mensual || 20
  const fin = finDeMes(mes)
  const avance = diasHabiles(`${mes}-01`, hoy) / Math.max(1, diasHabiles(`${mes}-01`, fin))
  const quedan = diasHabiles(hoy, fin)
  const faltan = Math.max(0, meta - r.validas)
  const contacto = (cfg?.nombre_contacto ?? 'Contacto').toLowerCase()

  const resumen = [
    'RESUMEN DEL DÍA: ' + diaSemana(hoy) + ' ' + fechaMensaje(hoy, '/'),
    'ASESOR(A): ' + mayus(perfil.nombre),
    'COLEGIOS VISITADOS: ' + r.hoyVis.length,
    'CON INGRESO: ' + r.ingresos,
    'DOCENTES CONVERSADOS: ' + r.contactos,
    'VENTAS DE HOY: ' + r.ventasHoy.length,
    'MOVILIDAD: ' + Math.round(r.movilidad / 100),
    'VENTAS DEL MES: ' + r.validas + ' DE ' + meta,
    mayus(cfg?.firma),
  ].join('\n')

  async function quitar(tabla, id) {
    if (quitando !== id) {
      setQuitando(id)
      return
    }
    const { error: e } = await supabase.from(tabla).delete().eq('id', id)
    setQuitando(null)
    if (e) setFallo(traducirError(e))
    else recargar()
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>Mi avance</h1>
      {(error || fallo) && <p className="aviso aviso--crit">{error || fallo}</p>}

      <section>
        <h2>Mi meta del mes</h2>
        <div className="grande">
          {r.validas} <small>/ {meta} ventas</small>
        </div>
        <div className="barra">
          <i style={{ width: Math.min(100, (r.validas / meta) * 100) + '%' }} />
          <u style={{ left: Math.min(100, avance * 100) + '%' }} />
        </div>
        <p className="small muted">
          {faltan
            ? `Te faltan ${faltan} en ${quedan} días hábiles: ${Math.ceil((faltan / Math.max(1, quedan)) * 10) / 10} por día. La marca negra es donde deberías ir hoy.`
            : 'Meta cumplida. Todo lo que cierres ahora es extra.'}
          {r.porRevisar > 0 && ` Tienes ${r.porRevisar} por revisar: no cuentan hasta que sean de nombrado con planilla.`}
        </p>
      </section>

      <section>
        <h2>Hoy</h2>
        <div className="kpis">
          <div className="kpi"><span>Ventas</span><b>{r.ventasHoy.length}</b></div>
          <div className="kpi"><span>Visitas</span><b>{r.hoyVis.length}</b><small>{r.ingresos} con ingreso</small></div>
          <div className="kpi"><span>{titulo(contacto)}s conversados</span><b>{r.contactos}</b></div>
          <div className="kpi"><span>Movilidad</span><b>{soles(r.movilidad)}</b></div>
        </div>
        <ul className="lista">
          {r.hoyVis.map((v) => (
            <li key={v.id}>
              <span>
                Visita · {v.lugar}
                <small>{titulo(v.resultado)}</small>
              </span>
              <button type="button" className="btn btn--sec btn--chico" onClick={() => quitar('visitas', v.id)}>
                {quitando === v.id ? '¿Seguro?' : 'Quitar'}
              </button>
            </li>
          ))}
          {r.ventasHoy.map((v) => (
            <li key={v.id}>
              <span>
                Venta · {titulo(v.nombre)}
                <small>{titulo(v.pago)}</small>
              </span>
              <button type="button" className="btn btn--sec btn--chico" onClick={() => quitar('ventas', v.id)}>
                {quitando === v.id ? '¿Seguro?' : 'Quitar'}
              </button>
            </li>
          ))}
          {r.hoyVis.length + r.ventasHoy.length === 0 && (
            <li><span className="muted">Aún no has registrado visitas ni ventas hoy.</span></li>
          )}
        </ul>
        <a className="btn btn--sec" href={enlaceWhatsApp(resumen)} target="_blank" rel="noopener noreferrer">
          Enviar resumen del día por WhatsApp
        </a>
      </section>

      <section>
        <h2>Colegios por volver</h2>
        <ul className="lista">
          {r.volver.map((v) => (
            <li key={v.id}>
              <span>
                {v.lugar}
                <small>{titulo(v.resultado)} · {fechaCorta(v.fecha)}{v.observacion ? ' · ' + v.observacion : ''}</small>
              </span>
            </li>
          ))}
          {r.volver.length === 0 && <li><span className="muted">Ninguno pendiente este mes.</span></li>}
        </ul>
      </section>

      <section>
        <h2>Mis ventas del mes</h2>
        <ul className="lista">
          {r.ventasMes.map((v) => (
            <li key={v.id}>
              <span>
                {titulo(v.nombre)}
                <small>{[titulo(v.programa), titulo(v.pago), fechaCorta(v.fecha)].filter(Boolean).join(' · ')}</small>
              </span>
              <span className={`pill ${v.estado === 'caida' ? 'crit' : esValida(v, cfg) ? 'ok' : 'warn'}`}>
                {v.estado === 'caida' ? 'Caída' : esValida(v, cfg) ? 'Válida' : 'Por revisar'}
              </span>
            </li>
          ))}
          {r.ventasMes.length === 0 && <li><span className="muted">Todavía no registras ventas este mes.</span></li>}
        </ul>
      </section>
    </main>
  )
}

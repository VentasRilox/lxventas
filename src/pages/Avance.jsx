import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { useRango } from '../lib/useDatos'
import { traducirError } from '../lib/errores'
import { diaSemana, diasHabiles, fechaCorta, fechaDeMarca, fechaLocalHoy, fechaMensaje } from '../lib/fecha'
import { periodoDe, textoPeriodo } from '../lib/periodo'
import { esValida, estadoVenta, faltaContrato, faltaPago, mayus, soles, titulo } from '../lib/reglas'
import { enlaceWhatsApp } from '../lib/mensajes'
import PantallaEstado from '../components/PantallaEstado.jsx'

export default function Avance() {
  const { perfil, cfg, zona } = useSesion()
  const hoy = fechaLocalHoy()
  const periodo = periodoDe(zona?.fecha_apertura, hoy)
  const { visitas, ventas, cargando, error, recargar } = useRango(periodo.trae, periodo.hasta)
  const [quitando, setQuitando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [registradas, setRegistradas] = useState(0)

  // Personas que el asesor registró hoy, para cuadrar con lo declarado en sus visitas.
  useEffect(() => {
    let activo = true
    supabase
      .from('prospectos')
      .select('creado_en, ultimo_contacto')
      .eq('asesor_id', perfil.id)
      .eq('ultimo_contacto', hoy)
      .then(({ data }) => {
        if (activo) setRegistradas((data ?? []).filter((p) => fechaDeMarca(p.creado_en) === hoy).length)
      })
    return () => {
      activo = false
    }
  }, [perfil.id, hoy])

  const r = useMemo(() => {
    const misVisitas = visitas.filter((v) => v.asesor_id === perfil.id)
    const misVentas = ventas.filter((v) => v.asesor_id === perfil.id)
    const validas = misVentas.filter((v) => esValida(v, cfg))
    const hoyVis = misVisitas.filter((v) => v.fecha === hoy)
    const ultima = {}
    for (const v of misVisitas) ultima[v.lugar] = v
    return {
      validas: validas.length,
      sinPago: misVentas.filter((v) => faltaPago(v, cfg)).length,
      porRevisar: misVentas.filter((v) => v.estado !== 'caida' && !esValida(v, cfg) && !faltaPago(v, cfg)).length,
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
  const inicio = hoy < periodo.desde ? periodo.desde : hoy
  const avance = hoy < periodo.desde ? 0 : diasHabiles(periodo.desde, hoy) / Math.max(1, diasHabiles(periodo.desde, periodo.hasta))
  const quedan = diasHabiles(inicio, periodo.hasta)
  const faltan = Math.max(0, meta - r.validas)

  const resumen = [
    'RESUMEN DEL DÍA: ' + diaSemana(hoy) + ' ' + fechaMensaje(hoy, '/'),
    'ASESOR(A): ' + mayus(perfil.nombre),
    'COLEGIOS VISITADOS: ' + r.hoyVis.length,
    'CON INGRESO: ' + r.ingresos,
    'DOCENTES CONVERSADOS: ' + r.contactos,
    'REGISTRADOS EN EL SISTEMA: ' + registradas,
    'VENTAS DE HOY: ' + r.ventasHoy.length,
    'MOVILIDAD: ' + Math.round(r.movilidad / 100),
    'VENTAS DEL PERIODO: ' + r.validas + ' DE ' + meta,
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
        <h2>Mi meta · {textoPeriodo(periodo)}</h2>
        <div className="grande">
          {r.validas} <small>/ {meta} ventas válidas</small>
        </div>
        <div className="barra">
          <i style={{ width: Math.min(100, (r.validas / meta) * 100) + '%' }} />
          <u style={{ left: Math.min(100, avance * 100) + '%' }} />
        </div>
        <p className="small muted">
          {faltan
            ? `Te faltan ${faltan} en ${quedan} días hábiles: ${Math.ceil((faltan / Math.max(1, quedan)) * 10) / 10} por día. La marca negra es donde deberías ir hoy.`
            : 'Meta cumplida. Todo lo que cierres ahora es extra.'}
          {r.sinPago > 0 && ` Ya vendiste ${r.sinPago} más, pero ${r.sinPago === 1 ? 'falta' : 'faltan'} su primera mensualidad: ${r.sinPago === 1 ? 'contará' : 'contarán'} cuando se pague y tu supervisor lo confirme.`}
          {r.porRevisar > 0 && ` Tienes ${r.porRevisar} por revisar: no cuentan hasta que sean de nombrado con planilla.`}
        </p>
      </section>

      <section>
        <h2>Hoy</h2>
        <div className="kpis">
          <div className="kpi"><span>Ventas de hoy</span><b>{r.ventasHoy.length}</b><small>{r.ventasHoy.filter((v) => esValida(v, cfg)).length} con pago confirmado</small></div>
          <div className="kpi"><span>Visitas</span><b>{r.hoyVis.length}</b><small>{r.ingresos} con ingreso</small></div>
          <div className="kpi">
            <span>Personas registradas</span>
            <b>{registradas} <small style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>de {r.contactos}</small></b>
            <small>{registradas < r.contactos ? `Atendiste ${r.contactos} según tus visitas: te falta registrar ${r.contactos - registradas}` : 'Atendidas según tus visitas'}</small>
          </div>
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
          {r.volver.length === 0 && <li><span className="muted">Ninguno pendiente en este periodo.</span></li>}
        </ul>
      </section>

      <section>
        <h2>Mis ventas del periodo</h2>
        <ul className="lista">
          {r.ventasMes.map((v) => (
            <li key={v.id}>
              <span>
                {titulo(v.nombre)}
                <small>{[titulo(v.programa), titulo(v.pago), fechaCorta(v.fecha)].filter(Boolean).join(' · ')}</small>
                {cfg?.pide_contrato && v.estado !== 'caida' && (
                  <small>
                    {faltaContrato(v).length ? <Link to={`/venta?id=${v.id}`}>Contrato incompleto: completar datos</Link> : 'Contrato completo'}
                  </small>
                )}
              </span>
              <span className={`pill ${estadoVenta(v, cfg)[0]}`}>{estadoVenta(v, cfg)[1]}</span>
            </li>
          ))}
          {r.ventasMes.length === 0 && <li><span className="muted">Todavía no registras ventas en este periodo.</span></li>}
        </ul>
      </section>
    </main>
  )
}

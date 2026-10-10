import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { useRango } from '../lib/useDatos'
import { traducirError } from '../lib/errores'
import { diaSemana, diasHabiles, fechaCorta, fechaDeMarca, fechaLocalHoy, fechaMensaje } from '../lib/fecha'
import { periodoDe, textoPeriodo } from '../lib/periodo'
import { ESCALA_PREMIO, esValida, estadoVenta, faltaContrato, faltaPago, mayus, premioAsesor, soles, titulo } from '../lib/reglas'
import { enlaceWhatsApp } from '../lib/mensajes'
import PantallaEstado from '../components/PantallaEstado.jsx'
import MetaDelDia from '../components/MetaDelDia.jsx'

export default function Avance() {
  const { perfil, cfg, zona } = useSesion()
  const hoy = fechaLocalHoy()
  const periodo = periodoDe(zona?.fecha_apertura, hoy)
  const { visitas, ventas, cargando, error, recargar } = useRango(periodo.trae, periodo.hasta)
  const [quitando, setQuitando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [registradas, setRegistradas] = useState(0)
  const [ranking, setRanking] = useState(null)

  // Ventas válidas de cada asesor de la misma zona (la base solo entrega el conteo).
  useEffect(() => {
    let activo = true
    supabase.rpc('ranking_zona', { p_desde: periodo.trae, p_hasta: periodo.hasta }).then(({ data, error: e }) => {
      if (activo) setRanking(e ? null : data ?? [])
    })
    return () => {
      activo = false
    }
  }, [periodo.trae, periodo.hasta])

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
      visitasPeriodo: misVisitas.slice().reverse(),
    }
  }, [visitas, ventas, perfil.id, cfg, hoy])

  if (cargando) return <PantallaEstado mensaje="Cargando..." />

  const meta = perfil.meta_mensual || 20
  const inicio = hoy < periodo.desde ? periodo.desde : hoy
  const avance = hoy < periodo.desde ? 0 : diasHabiles(periodo.desde, hoy) / Math.max(1, diasHabiles(periodo.desde, periodo.hasta))
  const quedan = diasHabiles(inicio, periodo.hasta)
  const faltan = Math.max(0, meta - r.validas)
  const ganado = premioAsesor(r.validas)
  const siguiente = ESCALA_PREMIO.find(([n]) => r.validas < n)

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
      <div className="fila">
        <h1>Mi avance</h1>
        <Link to="/formatos" className="btn btn--sec btn--chico">Mis formatos</Link>
      </div>
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
        <h2>Tu premio del periodo</h2>
        <div className="escala">
          {ESCALA_PREMIO.map(([n, monto]) => (
            <div key={n} className={r.validas >= n ? 'logrado' : n === siguiente?.[0] ? 'siguiente' : undefined}>
              <b>{n}</b>válidas<br />S/ {monto.toLocaleString('es-PE')}
            </div>
          ))}
        </div>
        <p className="small">
          {ganado ? <b>Ya aseguraste S/ {ganado.toLocaleString('es-PE')}. </b> : 'Aún no llegas al primer premio. '}
          {siguiente ? `Te ${siguiente[0] - r.validas === 1 ? 'falta 1 válida' : `faltan ${siguiente[0] - r.validas} válidas`} para ganar S/ ${siguiente[1].toLocaleString('es-PE')}.` : '¡Llegaste al premio máximo!'}
          {r.sinPago > 0 && ` Si se confirma el pago de tus ${r.sinPago === 1 ? 'venta pendiente' : r.sinPago + ' ventas pendientes'}, llegas a ${r.validas + r.sinPago}.`}
        </p>
        <p className="small muted">Se suma a tu básico. Solo cuentan las ventas válidas: nombrado, por planilla y con la primera mensualidad confirmada.</p>
      </section>

      {ranking && ranking.length > 1 && (
        <section>
          <h2>Ranking de tu {(cfg?.nombre_zona ?? 'zona').toUpperCase()}</h2>
          <ul className="lista ranking">
            {ranking
              .slice()
              .sort((a, b) => b.validas - a.validas || a.nombre.localeCompare(b.nombre))
              .map((x, i, todos) => {
                const puesto = todos.findIndex((y) => y.validas === x.validas) + 1
                return (
                  <li key={x.asesor_id} className={x.es_yo ? 'yo' : undefined}>
                    <span className="fila" style={{ justifyContent: 'flex-start', gap: 8, margin: 0 }}>
                      <span className="puesto">{puesto}.º</span>
                      {x.es_yo ? <b>Tú</b> : titulo(x.nombre)}
                    </span>
                    <span className={`pill ${puesto === 1 ? 'ok' : 'neu'}`}>{x.validas} {x.validas === 1 ? 'válida' : 'válidas'}</span>
                  </li>
                )
              })}
          </ul>
          <p className="small muted">Ventas válidas del periodo. Se actualiza cuando el supervisor confirma los pagos.</p>
        </section>
      )}

      <MetaDelDia />

      <section>
        <h2>Hoy</h2>
        <div className="kpis">
          <div className="kpi"><span>Ventas de hoy</span><b>{r.ventasHoy.length}</b><small>{r.ventasHoy.filter((v) => esValida(v, cfg)).length} con pago confirmado</small></div>
          <div className="kpi"><span>Visitas</span><b>{r.hoyVis.length}</b><small>{r.ingresos} con ingreso</small></div>
          <div className="kpi">
            <span>Atendidos (lo que escribiste)</span>
            <b>{r.contactos}</b>
            <small>{r.hoyVis.filter((v) => v.contactos > 0).map((v) => `${titulo(v.lugar)}: ${v.contactos}`).join(' + ') || 'Sale del número que pones en cada visita'}</small>
          </div>
          <div className="kpi">
            <span>Registrados con nombre</span>
            <b>{registradas}</b>
            <small>{registradas < r.contactos ? `Te falta registrar ${r.contactos - registradas} de los ${r.contactos} atendidos` : 'Todos los atendidos están registrados'}</small>
          </div>
          <div className="kpi"><span>Movilidad</span><b>{soles(r.movilidad)}</b></div>
        </div>
        <ul className="lista">
          {r.hoyVis.map((v) => (
            <li key={v.id}>
              <span>
                Visita · {v.lugar}
                <small>{[titulo(v.resultado), v.con_ingreso && `${v.contactos} ${v.contactos === 1 ? 'atendido' : 'atendidos'}`, `movilidad ${soles(v.movilidad_centimos)}`].filter(Boolean).join(' · ')}</small>
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

      {r.movilidad > 2500 && <p className="aviso">Tu movilidad de hoy suma {soles(r.movilidad)}. El tope es S/ 25 por día.</p>}
      <p className="small muted">
        "Atendidos" es el número que escribiste en cada visita, no una lista de personas. "Registrados con nombre" son los que guardaste en Registrar. "Movilidad" es la suma de lo que pusiste en cada visita. Si un número está mal, quita esa visita y regístrala de nuevo.
      </p>

      <section>
        <h2>Colegios visitados en el periodo · {r.visitasPeriodo.length}</h2>
        <ul className="lista">
          {r.visitasPeriodo.map((v) => (
            <li key={v.id}>
              <span>
                {v.lugar}
                <small>
                  {[fechaCorta(v.fecha), titulo(v.resultado), v.con_ingreso && `${v.contactos} ${v.contactos === 1 ? 'atendido' : 'atendidos'}`, `movilidad ${soles(v.movilidad_centimos)}`].filter(Boolean).join(' · ')}
                </small>
              </span>
            </li>
          ))}
          {r.visitasPeriodo.length === 0 && <li><span className="muted">Aún no registras visitas en este periodo.</span></li>}
        </ul>
        <Link className="small" to="/seguimiento">Ver a todas las personas que registraste, en Cartera</Link>
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

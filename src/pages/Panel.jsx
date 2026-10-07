import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { useCobros, useMes, useProspectos } from '../lib/useDatos'
import { traducirError } from '../lib/errores'
import { diasEntre, diasHabiles, fechaCorta, fechaLocalHoy, finDeMes, lunesDe, mesDe } from '../lib/fecha'
import { BASICO, MOTIVOS, bonoSupervisor, esCaida, esValida, estadoAvance, estadoVenta, faltaPago, montoCuota, pagoJefe, premioAsesor, soles, titulo } from '../lib/reglas'
import PantallaEstado from '../components/PantallaEstado.jsx'
import Cobros from './panel/Cobros.jsx'
import Asistencia from './panel/Asistencia.jsx'

const TABS = {
  supervisor: [['resumen', 'Resumen'], ['cobros', 'Cobros'], ['asistencia', 'Asistencia'], ['asesores', 'Mi equipo'], ['ventas', 'Ventas'], ['seguimiento', 'Seguimiento']],
  jefe: [['resumen', 'Resumen'], ['cobros', 'Cobros'], ['asistencia', 'Asistencia'], ['supervisores', 'Supervisores'], ['asesores', 'Asesores'], ['ventas', 'Ventas'], ['seguimiento', 'Seguimiento'], ['dinero', 'Dinero']],
  gerencia: [['resumen', 'Resumen'], ['cobros', 'Cobros'], ['asistencia', 'Asistencia'], ['supervisores', 'Supervisores'], ['ventas', 'Ventas'], ['dinero', 'Dinero']],
}

function Pill({ e }) {
  return <span className={`pill ${e[0]}`}>{e[1]}</span>
}

function Barra({ valor, meta, avance }) {
  return (
    <div className="barra">
      <i style={{ width: Math.min(100, meta ? (valor / meta) * 100 : 0) + '%' }} />
      <u style={{ left: Math.min(100, avance * 100) + '%' }} />
    </div>
  )
}

function Kpi({ t, v, s }) {
  return (
    <div className="kpi">
      <span>{t}</span>
      <b>{v}</b>
      {s && <small>{s}</small>}
    </div>
  )
}

function pct(a, b) {
  return b ? Math.round((a / b) * 100) + '%' : '–'
}

function nuevo() {
  return { val: 0, pag: 0, rev: 0, cai: 0, sem: 0, caja: 0, vis: 0, ing: 0, con: 0, mov: 0, visRef: 0, ult: '' }
}

// Suma visitas y ventas por zona y por asesor.
function calcular({ visitas, ventas, perfiles, zonasVisibles, cfg, mes, hoy }) {
  const fin = finDeMes(mes)
  const ref = mesDe(hoy) === mes ? hoy : hoy < `${mes}-01` ? `${mes}-01` : fin
  const habTot = diasHabiles(`${mes}-01`, fin)
  const avance = hoy < `${mes}-01` ? 0 : diasHabiles(`${mes}-01`, ref) / Math.max(1, habTot)
  const lunes = lunesDe(ref)
  const zona = {}
  const asesor = {}
  const tot = nuevo()
  for (const z of zonasVisibles) zona[z.id] = { ...nuevo(), id: z.id, nombre: z.nombre, meta: z.meta_mensual, supervisor_id: z.supervisor_id }
  for (const p of perfiles) if (p.rol === 'asesor' && p.activo) asesor[p.id] = { ...nuevo(), id: p.id, nombre: p.nombre, zona_id: p.zona_id, meta: p.meta_mensual || 20 }

  const destinos = (r) => {
    const lista = [tot]
    if (zona[r.zona_id]) lista.push(zona[r.zona_id])
    if (!asesor[r.asesor_id]) {
      const p = perfiles.find((x) => x.id === r.asesor_id)
      if (p?.rol === 'asesor') asesor[p.id] = { ...nuevo(), id: p.id, nombre: p.nombre, zona_id: p.zona_id, meta: p.meta_mensual || 20, inactivo: true }
    }
    if (asesor[r.asesor_id]) lista.push(asesor[r.asesor_id])
    return lista
  }
  for (const v of ventas) {
    for (const o of destinos(v)) {
      if (esCaida(v)) o.cai++
      else if (esValida(v, cfg)) {
        o.val++
        o.caja += montoCuota(v, cfg)
        if (v.fecha >= lunes && v.fecha <= ref) o.sem++
      } else if (faltaPago(v, cfg)) o.pag++
      else o.rev++
      if (v.fecha > o.ult) o.ult = v.fecha
    }
  }
  for (const v of visitas) {
    for (const o of destinos(v)) {
      o.vis++
      if (v.con_ingreso) o.ing++
      o.con += v.contactos
      o.mov += v.movilidad_centimos
      if (v.fecha === ref) o.visRef++
      if (v.fecha > o.ult) o.ult = v.fecha
    }
  }
  const zonas = Object.values(zona)
  const asesores = Object.values(asesor).sort((a, b) => nombreZona(zona, a).localeCompare(nombreZona(zona, b)) || b.val - a.val)
  tot.meta = zonas.reduce((s, z) => s + z.meta, 0)
  return { ref, avance, quedan: diasHabiles(ref, fin), zona, zonas, asesores, tot }
}

function nombreZona(zona, a) {
  return zona[a.zona_id]?.nombre ?? ''
}

export default function Panel() {
  const { rol, perfil, cfg, zonas } = useSesion()
  const hoy = fechaLocalHoy()
  const [mes, setMes] = useState(mesDe(hoy))
  const [tab, setTab] = useState('resumen')
  const { visitas, ventas, cargando, error, recargar } = useMes(mes)
  const seguimiento = useProspectos()
  const pagos = useCobros()
  const [perfiles, setPerfiles] = useState([])
  const [fallo, setFallo] = useState('')

  useEffect(() => {
    supabase.from('perfiles').select('id, nombre, rol, zona_id, meta_mensual, activo, telefono').then(({ data }) => setPerfiles(data ?? []))
  }, [])

  const zonasVisibles = useMemo(
    () => zonas.filter((z) => z.activa && (rol !== 'supervisor' || z.supervisor_id === perfil.id)),
    [zonas, rol, perfil.id]
  )
  const C = useMemo(
    () => calcular({ visitas, ventas, perfiles, zonasVisibles, cfg, mes, hoy }),
    [visitas, ventas, perfiles, zonasVisibles, cfg, mes, hoy]
  )

  const tabs = TABS[rol] ?? TABS.gerencia
  const actual = tabs.some((t) => t[0] === tab) ? tab : 'resumen'
  const nz = cfg?.nombre_zona ?? 'Zona'
  const contacto = cfg?.nombre_contacto ?? 'Contacto'
  const valorVenta = cfg?.valor_venta_centimos ?? 0
  const metaSemanal = cfg?.meta_semanal_zona ?? 15
  const nombreDe = (id) => titulo(perfiles.find((p) => p.id === id)?.nombre ?? '—')
  const supervisores = perfiles.filter((p) => p.rol === 'supervisor' && p.activo)

  async function marcarCaida(v) {
    setFallo('')
    const { error: e } = await supabase.from('ventas').update({ estado: v.estado === 'caida' ? 'registrada' : 'caida' }).eq('id', v.id)
    if (e) setFallo(traducirError(e))
    else recargar()
  }

  const cuota = cfg?.primera_cuota_centimos ?? 13000
  const porConfirmar = pagos.cobros.filter((v) => v.cuota_estado === 'reportada').length
  const recargarTodo = () => {
    recargar()
    seguimiento.recargar()
    pagos.recargar()
  }

  return (
    <main className="contenido">
      <div className="fila" style={{ flexWrap: 'wrap' }}>
        <h1>Panel comercial</h1>
        <div className="fila">
          <input type="month" aria-label="Mes" style={{ width: 'auto' }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          <button type="button" className="btn btn--sec btn--chico" onClick={recargarTodo}>
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      {(error || fallo) && <p className="aviso aviso--crit">{error || fallo}</p>}

      <div className="tabs">
        {tabs.map(([v, t]) => (
          <button key={v} type="button" className="tab" aria-pressed={actual === v} onClick={() => setTab(v)}>
            {t}
            {v === 'cobros' && pagos.cobros.length > 0 && ` (${pagos.cobros.length})`}
          </button>
        ))}
      </div>

      {cargando && visitas.length + ventas.length === 0 ? (
        <PantallaEstado mensaje="Cargando..." />
      ) : (
        <>
          {actual === 'resumen' && (
            <>
              <section>
                <h2>Avance del mes</h2>
                <div className="kpis">
                  <Kpi t="Ventas válidas" v={`${C.tot.val} de ${C.tot.meta}`} s="Nombrado, planilla y primera mensualidad pagada" />
                  <Kpi t="Caja del mes" v={soles(C.tot.caja)} s={`Meta: ${soles(C.tot.meta * cuota)}`} />
                  <Kpi t="Falta pago" v={C.tot.pag} s={porConfirmar ? `${porConfirmar} por confirmar en Cobros` : 'Vendidas, sin primera mensualidad'} />
                  <Kpi t="Esta semana" v={C.tot.sem} s={`Meta semanal: ${metaSemanal * C.zonas.length}`} />
                  <Kpi t="Por revisar" v={C.tot.rev} s="No cumplen nombrado y planilla" />
                  {rol === 'supervisor' ? (
                    <Kpi t="Mi bono del mes" v={'S/ ' + C.zonas.reduce((s, z) => s + bonoSupervisor(z.val), 0).toLocaleString('en-US')} s="40 ventas: S/ 1,000 · 60: S/ 2,000" />
                  ) : (
                    <Kpi t="Valor contratado" v={soles(C.tot.val * valorVenta)} s={`${soles(valorVenta)} por venta válida`} />
                  )}
                  {rol === 'gerencia' && (
                    <Kpi t={`${contacto}s de interés alto`} v={seguimiento.prospectos.filter((p) => p.estado === 'abierto' && p.interes === 'alto').length} s="En seguimiento, por cerrar" />
                  )}
                </div>
              </section>
              <section>
                <h2>{nz}</h2>
                <div className="tarjetas">
                  {C.zonas.map((z) => {
                    const faltan = Math.max(0, z.meta - z.val)
                    return (
                      <div className="tarjeta" key={z.id}>
                        <div className="fila">
                          <h3>{titulo(z.nombre)}</h3>
                          <Pill e={estadoAvance(z.val, z.meta, C.avance)} />
                        </div>
                        <div className="grande">
                          {z.val} <small>/ {z.meta} ventas</small>
                        </div>
                        <Barra valor={z.val} meta={z.meta} avance={C.avance} />
                        <p className="small muted">
                          {faltan
                            ? `Faltan ${faltan} en ${C.quedan} días hábiles: ${Math.ceil((faltan / Math.max(1, C.quedan)) * 10) / 10} por día.`
                            : 'Todo lo que se cierre ahora es extra.'}{' '}
                          Semana: {z.sem} de {metaSemanal}.
                        </p>
                        <div className="embudo">
                          <div><b>{z.vis}</b><span>Visitas</span></div>
                          <div><b>{z.con}</b><span>{contacto}s</span></div>
                          <div><b>{z.pag}</b><span>Falta pago</span></div>
                          <div><b>{soles(z.caja)}</b><span>Caja</span></div>
                        </div>
                        {rol !== 'supervisor' && <p className="small muted">Supervisor: {z.supervisor_id ? nombreDe(z.supervisor_id) : 'por asignar'}</p>}
                      </div>
                    )
                  })}
                </div>
                {C.zonas.length === 0 && <p className="muted">Todavía no hay {nz} registradas. {rol === 'jefe' ? 'Agrégalas en Equipo.' : ''}</p>}
                <p className="small muted">La marca negra de cada barra es donde debería ir hoy según los días hábiles del mes.</p>
              </section>
            </>
          )}

          {actual === 'supervisores' && (
            <section>
              <h2>Avance de los supervisores</h2>
              <div className="tarjetas">
                {supervisores.map((sp) => {
                  const suyas = C.zonas.filter((z) => z.supervisor_id === sp.id)
                  const o = suyas.reduce((a, z) => ({ val: a.val + z.val, meta: a.meta + z.meta, sem: a.sem + z.sem, rev: a.rev + z.rev, vis: a.vis + z.vis, ing: a.ing + z.ing, bono: a.bono + bonoSupervisor(z.val) }), { val: 0, meta: 0, sem: 0, rev: 0, vis: 0, ing: 0, bono: 0 })
                  const as = C.asesores.filter((a) => !a.inactivo && suyas.some((z) => z.id === a.zona_id))
                  const sin = as.filter((a) => !a.ult || a.ult < C.ref).length
                  return (
                    <div className="tarjeta" key={sp.id}>
                      <div className="fila">
                        <h3>{titulo(sp.nombre)}</h3>
                        <Pill e={estadoAvance(o.val, o.meta, C.avance)} />
                      </div>
                      <p className="small muted">
                        {suyas.length ? `${nz} ${suyas.map((z) => titulo(z.nombre)).join(' y ')}` : `Sin ${nz} asignada`} · {as.length} de {3 * suyas.length} asesores
                      </p>
                      <div className="grande">
                        {o.val} <small>/ {o.meta} ventas</small>
                      </div>
                      <Barra valor={o.val} meta={o.meta} avance={C.avance} />
                      <div className="embudo">
                        <div><b>{o.sem}</b><span>Semana (de {metaSemanal * suyas.length})</span></div>
                        <div><b>{pct(o.ing, o.vis)}</b><span>Con ingreso</span></div>
                        <div><b>{o.rev}</b><span>Por revisar</span></div>
                        <div><b>S/ {o.bono.toLocaleString('en-US')}</b><span>Bono</span></div>
                      </div>
                      <p className="small muted">
                        {as.length ? (sin ? `${sin} de ${as.length} asesores sin reporte el ${fechaCorta(C.ref)}.` : `Todos sus asesores reportaron el ${fechaCorta(C.ref)}.`) : 'Todavía no tiene asesores.'}
                      </p>
                    </div>
                  )
                })}
              </div>
              {supervisores.length === 0 && <p className="muted">Aún no hay supervisores registrados.</p>}
              {C.zonas.some((z) => !z.supervisor_id) && (
                <p className="aviso">{nz} sin supervisor: {C.zonas.filter((z) => !z.supervisor_id).map((z) => titulo(z.nombre)).join(', ')}.</p>
              )}
            </section>
          )}

          {actual === 'asesores' && (
            <>
              <section>
                <h2>Asesores</h2>
                <div className="tabla">
                  <table>
                    <thead>
                      <tr><th>Asesor</th><th>{nz}</th><th className="n">Ventas</th><th className="n">Semana</th><th className="n">Visitas {fechaCorta(C.ref)}</th><th className="n">Falta pago</th><th className="n">Por revisar</th><th>Último reporte</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {C.asesores.map((a) => {
                        const finDeSemana = [0, 6].includes(new Date(C.ref + 'T12:00:00').getDay())
                        const e = a.inactivo ? ['neu', 'Inactivo'] : !a.ult ? ['crit', 'Sin reportes'] : a.ult < C.ref && !finDeSemana ? ['warn', 'Sin reporte hoy'] : estadoAvance(a.val, a.meta, C.avance)
                        return (
                          <tr key={a.id}>
                            <td>{titulo(a.nombre)}</td>
                            <td>{titulo(nombreZona(C.zona, a))}</td>
                            <td className="n">{a.val} / {a.meta}</td>
                            <td className="n">{a.sem}</td>
                            <td className="n">{a.visRef}</td>
                            <td className="n">{a.pag ? <span className="pill warn">{a.pag}</span> : 0}</td>
                            <td className="n">{a.rev}</td>
                            <td>{a.ult ? fechaCorta(a.ult) : '–'}</td>
                            <td><Pill e={e} /></td>
                          </tr>
                        )
                      })}
                      {C.asesores.length === 0 && <tr><td colSpan="9" className="muted">Aún no hay asesores registrados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h2>Colegios por volver</h2>
                <ul className="lista">
                  {Object.values(visitas.reduce((m, v) => ({ ...m, [v.zona_id + '|' + v.lugar]: v }), {}))
                    .filter((v) => !v.con_ingreso)
                    .map((v) => (
                      <li key={v.id}>
                        <span>
                          {v.lugar}
                          <small>{nombreDe(v.asesor_id)} · {titulo(v.resultado)} el {fechaCorta(v.fecha)}{v.observacion ? ' · ' + v.observacion : ''}</small>
                        </span>
                      </li>
                    ))}
                  {!visitas.some((v) => !v.con_ingreso) && <li><span className="muted">Ningún colegio pendiente.</span></li>}
                </ul>
              </section>
            </>
          )}

          {actual === 'ventas' && (
            <section>
              <h2>Ventas del mes</h2>
              <div className="tabla">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>{contacto}</th><th>{cfg?.nombre_lugar ?? 'Lugar'}</th><th>Asesor</th><th>Programa</th><th>Estado</th>{rol !== 'gerencia' && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {ventas.slice().reverse().map((v) => (
                      <tr key={v.id}>
                        <td>{fechaCorta(v.fecha)}</td>
                        <td>{titulo(v.nombre)}</td>
                        <td>{v.lugar}</td>
                        <td>{nombreDe(v.asesor_id)}</td>
                        <td>{titulo(v.programa)}</td>
                        <td><Pill e={estadoVenta(v, cfg)} /></td>
                        {rol !== 'gerencia' && (
                          <td>
                            <button type="button" className="btn btn--sec btn--chico" onClick={() => marcarCaida(v)}>
                              {esCaida(v) ? 'Reactivar' : 'Marcar caída'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {ventas.length === 0 && <tr><td colSpan="7" className="muted">Todavía no hay ventas registradas este mes.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="small muted">Válida: nombrado, con descuento por planilla y primera mensualidad confirmada. Una venta caída o sin pago no cuenta para la meta ni para los bonos.</p>
            </section>
          )}

          {actual === 'cobros' && (
            <Cobros cobros={pagos.cobros} recargar={recargarTodo} perfiles={perfiles} nombreDe={nombreDe} cfg={cfg} rol={rol} />
          )}

          {actual === 'asistencia' && (
            <Asistencia mes={mes} diaInicial={C.ref} asesores={C.asesores} nombreZona={(a) => nombreZona(C.zona, a)} cfg={cfg} />
          )}

          {actual === 'seguimiento' && (
            <VistaSeguimiento prospectos={seguimiento.prospectos} recargar={seguimiento.recargar} perfiles={perfiles} nombreDe={nombreDe} cfg={cfg} rol={rol} hoy={hoy} mes={mes} />
          )}

          {actual === 'dinero' && (() => {
            const activos = C.asesores.filter((a) => !a.inactivo)
            const tAs = activos.reduce((s, a) => s + BASICO.asesor + premioAsesor(a.val), 0) * 100
            const tMov = C.asesores.reduce((s, a) => s + a.mov, 0)
            const tSup = supervisores.reduce((s, sp) => s + BASICO.supervisor + C.zonas.filter((z) => z.supervisor_id === sp.id).reduce((t, z) => t + bonoSupervisor(z.val), 0), 0) * 100
            const enMeta = C.zonas.filter((z) => z.val >= 60).length
            const jefe = pagoJefe(C.zonas.length, enMeta) * 100
            const costo = tAs + tMov + tSup + jefe
            const valor = C.tot.val * valorVenta
            return (
              <>
                <section>
                  <h2>Dinero del mes</h2>
                  <div className="kpis">
                    <Kpi t="Caja del mes" v={soles(C.tot.caja)} s="Primeras mensualidades confirmadas" />
                    <Kpi t="Valor contratado" v={soles(valor)} s={`${C.tot.val} ventas válidas × ${soles(valorVenta)}`} />
                    <Kpi t="Costo del equipo" v={soles(costo)} s="Básicos, premios, bonos y movilidad" />
                    <Kpi t="Costo sobre lo contratado" v={valor ? ((costo / valor) * 100).toFixed(1) + '%' : '–'} />
                    <Kpi t="Ventas caídas" v={C.tot.cai} s={pct(C.tot.cai, C.tot.cai + C.tot.val + C.tot.rev) + ' de las registradas'} />
                  </div>
                </section>
                <section>
                  <h2>Costo del equipo</h2>
                  <div className="tabla">
                    <table>
                      <thead><tr><th>Concepto</th><th>Detalle</th><th className="n">Monto</th></tr></thead>
                      <tbody>
                        <tr><td>{activos.length} asesores</td><td>Básico S/ 1,230 más premio por ventas válidas</td><td className="n">{soles(tAs)}</td></tr>
                        <tr><td>{supervisores.length} supervisores</td><td>Básico S/ 1,500 más bono por {nz} en 40 o 60</td><td className="n">{soles(tSup)}</td></tr>
                        <tr><td>Jefe de ventas</td><td>{C.zonas.length} {nz}, {enMeta} en 60 ventas</td><td className="n">{soles(jefe)}</td></tr>
                        <tr><td>Movilidad</td><td>La que reportaron los asesores en sus visitas</td><td className="n">{soles(tMov)}</td></tr>
                        <tr className="total"><td>Total</td><td></td><td className="n">{soles(costo)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="small muted">Estimación con la escala acordada y el mes completo. No incluye cargas de planilla ni premios en especie.</p>
                </section>
                <section>
                  <h2>Premio por asesor</h2>
                  <div className="tabla">
                    <table>
                      <thead><tr><th>Asesor</th><th>{nz}</th><th className="n">Ventas válidas</th><th className="n">Premio</th><th className="n">Movilidad</th></tr></thead>
                      <tbody>
                        {C.asesores.map((a) => (
                          <tr key={a.id}>
                            <td>{titulo(a.nombre)}</td>
                            <td>{titulo(nombreZona(C.zona, a))}</td>
                            <td className="n">{a.val}</td>
                            <td className="n">S/ {premioAsesor(a.val).toLocaleString('en-US')}</td>
                            <td className="n">{soles(a.mov)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )
          })()}
        </>
      )}
    </main>
  )
}

function VistaSeguimiento({ prospectos, recargar, perfiles, nombreDe, cfg, rol, hoy, mes }) {
  const [de, setDe] = useState('')
  const [a, setA] = useState('')
  const [mensaje, setMensaje] = useState('')
  const contacto = cfg?.nombre_contacto ?? 'Contacto'
  const escalar = cfg?.dias_escalar_supervisor ?? 7

  const abiertos = prospectos.filter((p) => p.estado === 'abierto')
  const porAsesor = {}
  for (const p of prospectos) {
    const o = (porAsesor[p.asesor_id] ??= { abiertos: 0, atrasados: 0, ganados: 0, perdidos: 0 })
    if (p.estado === 'abierto') {
      o.abiertos++
      if (p.proximo_contacto && p.proximo_contacto < hoy) o.atrasados++
    } else if (p.estado === 'ganado') o.ganados++
    else if (p.estado === 'perdido') o.perdidos++
  }
  const intervenir = abiertos.filter((p) => p.interes === 'alto' && diasEntre(p.creado_en.slice(0, 10), hoy) >= escalar)
  const porLugar = {}
  for (const p of abiertos) if (p.lugar) (porLugar[p.lugar] ??= []).push(p)
  const lugares = Object.entries(porLugar).filter(([, l]) => l.length >= 2).sort((x, y) => y[1].length - x[1].length)
  const motivos = {}
  for (const p of prospectos) {
    if (p.estado === 'perdido' && p.motivo_perdida) motivos[p.motivo_perdida] = (motivos[p.motivo_perdida] ?? 0) + 1
    else if (p.estado === 'abierto' && p.motivo) motivos[p.motivo] = (motivos[p.motivo] ?? 0) + 1
  }
  const asesores = perfiles.filter((p) => p.rol === 'asesor')

  async function reasignar() {
    setMensaje('')
    const destino = perfiles.find((p) => p.id === a)
    const { error, count } = await supabase
      .from('prospectos')
      .update({ asesor_id: a, zona_id: destino?.zona_id ?? null }, { count: 'exact' })
      .eq('asesor_id', de)
      .eq('estado', 'abierto')
    setMensaje(error ? traducirError(error) : `Listo: ${count ?? 0} ${contacto.toLowerCase()}s pasaron a ${nombreDe(a)}.`)
    if (!error) recargar()
  }

  return (
    <>
      <section>
        <h2>Seguimiento por asesor</h2>
        <div className="tabla">
          <table>
            <thead><tr><th>Asesor</th><th className="n">En seguimiento</th><th className="n">Atrasados</th><th className="n">Compraron</th><th className="n">No compraron</th><th className="n">Cierre</th></tr></thead>
            <tbody>
              {Object.entries(porAsesor).map(([id, o]) => (
                <tr key={id}>
                  <td>{nombreDe(id)}</td>
                  <td className="n">{o.abiertos}</td>
                  <td className="n">{o.atrasados ? <span className="pill crit">{o.atrasados}</span> : 0}</td>
                  <td className="n">{o.ganados}</td>
                  <td className="n">{o.perdidos}</td>
                  <td className="n">{pct(o.ganados, o.ganados + o.perdidos)}</td>
                </tr>
              ))}
              {Object.keys(porAsesor).length === 0 && <tr><td colSpan="6" className="muted">Aún no hay {contacto.toLowerCase()}s en seguimiento.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted">Cierre: de los seguimientos terminados, cuántos compraron. Mes del panel: {mes}; el seguimiento muestra toda la cartera.</p>
      </section>

      <section>
        <h2>Para que intervengas</h2>
        <ul className="lista">
          {intervenir.map((p) => (
            <li key={p.id}>
              <Link className="item" to={`/seguimiento/${p.id}`}>
                {titulo(p.nombre)}
                <small>{[p.lugar, nombreDe(p.asesor_id), `${diasEntre(p.creado_en.slice(0, 10), hoy)} días sin cerrar`].filter(Boolean).join(' · ')}</small>
              </Link>
              <span className="pill ok">Interés alto</span>
            </li>
          ))}
          {intervenir.length === 0 && <li><span className="muted">Nadie de interés alto lleva {escalar} días o más sin cerrar.</span></li>}
        </ul>
      </section>

      <section>
        <h2>Colegios con varios interesados</h2>
        <ul className="lista">
          {lugares.map(([lugar, l]) => (
            <li key={lugar}>
              <span>
                {lugar}
                <small>{l.map((p) => titulo(p.nombre).split(' ')[0]).join(', ')} · conviene volver con una charla</small>
              </span>
              <span className="pill neu">{l.length}</span>
            </li>
          ))}
          {lugares.length === 0 && <li><span className="muted">Ningún colegio con dos o más interesados.</span></li>}
        </ul>
      </section>

      <section>
        <h2>Dudas más frecuentes</h2>
        <ul className="lista">
          {Object.entries(motivos).sort((x, y) => y[1] - x[1]).map(([m, n]) => (
            <li key={m}>
              <span>{MOTIVOS.find((x) => x[0] === m)?.[1] ?? titulo(m.replace('_', ' '))}</span>
              <b className="num">{n}</b>
            </li>
          ))}
          {Object.keys(motivos).length === 0 && <li><span className="muted">Todavía no hay dudas registradas.</span></li>}
        </ul>
      </section>

      {rol === 'jefe' && (
        <section>
          <h2>Pasar la cartera de un asesor a otro</h2>
          <div className="grid2">
            <label htmlFor="r_de">
              De
              <select id="r_de" value={de} onChange={(e) => setDe(e.target.value)}>
                <option value="">Elige</option>
                {asesores.map((p) => <option key={p.id} value={p.id}>{titulo(p.nombre)}{p.activo ? '' : ' (inactivo)'}</option>)}
              </select>
            </label>
            <label htmlFor="r_a">
              A
              <select id="r_a" value={a} onChange={(e) => setA(e.target.value)}>
                <option value="">Elige</option>
                {asesores.filter((p) => p.activo && p.id !== de).map((p) => <option key={p.id} value={p.id}>{titulo(p.nombre)}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="btn btn--sec" disabled={!de || !a} onClick={reasignar}>
            Pasar los {contacto.toLowerCase()}s en seguimiento
          </button>
          {mensaje && <p className="aviso aviso--ok">{mensaje}</p>}
        </section>
      )}
    </>
  )
}

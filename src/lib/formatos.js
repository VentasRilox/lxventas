// Formatos de la empresa en PDF, llenados con lo que el asesor ya registró en
// la app: IPD, interesados, reporte de ventas, actividades diarias, planilla
// del asesor y control de entrega de merchandising. Las librerías de PDF se
// cargan recién al generar el archivo.
import { supabase, traerTodo } from './supabase'
import { traducirError } from './errores'
import { diaSemana, fechaDeMarca, horaCorta, horaDeMarca, sumarDias } from './fecha'
import { BASICO, estadoVenta, titulo } from './reglas'

export const FORMATOS = [
  { id: 'ipd', archivo: 'IPD', nombre: 'Informe de Producción Diaria (IPD)', ayuda: 'Todas las personas con las que hablaste', hoja: 'l' },
  { id: 'interesados', archivo: 'Reporte de interesados', nombre: 'Reporte de interesados', ayuda: 'Quienes siguen en seguimiento', hoja: 'l' },
  { id: 'ventas', archivo: 'Reporte de ventas', nombre: 'Reporte de ventas', ayuda: 'Una fila por contrato', hoja: 'l' },
  { id: 'actividades', archivo: 'Actividades diarias', nombre: 'Actividades diarias', ayuda: 'Lo que hiciste, hora por hora', hoja: 'p' },
  { id: 'planilla', archivo: 'Planilla', nombre: 'Planilla del asesor', ayuda: 'Ingreso, salida, jornada y movilidad por día', hoja: 'p' },
  { id: 'caja', archivo: 'Caja diaria', nombre: 'Caja diaria', ayuda: 'Mensualidades cobradas y gastos de movilidad', hoja: 'p' },
  { id: 'merchandising', archivo: 'Merchandising', nombre: 'Control de entrega de merchandising', ayuda: 'Lo que entregaste a cada docente', hoja: 'l' },
]

const AZUL = [23, 55, 90]
const RESULTADO = { abierto: 'En seguimiento', ganado: 'Compró', perdido: 'No compró', pausado: 'Para más adelante' }

// '2026-10-05' → '05/10/2026'
const fecha = (iso) => {
  const p = String(iso ?? '').slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''
}
const x = (si) => (si ? 'X' : '')
const soles = (c) => `S/ ${((c ?? 0) / 100).toFixed(2)}`
const unir = (...p) => p.filter(Boolean).join(' · ')

async function traer(asesorId, desde, hasta) {
  const deEl = (q) => q.eq('asesor_id', asesorId)
  const [pr, ve, vi, as, en] = await Promise.all([
    traerTodo(() => deEl(supabase.from('prospectos').select('*')).gte('creado_en', `${desde}T00:00:00-05:00`).lte('creado_en', `${hasta}T23:59:59-05:00`).order('creado_en')),
    traerTodo(() => deEl(supabase.from('ventas').select('*')).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en')),
    traerTodo(() => deEl(supabase.from('visitas').select('*')).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en')),
    traerTodo(() => deEl(supabase.from('asistencias').select('*')).gte('fecha', desde).lte('fecha', hasta).order('fecha')),
    traerTodo(() => deEl(supabase.from('entregas').select('*')).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en')),
  ])
  // Para la caja: mensualidades cobradas en esas fechas, aunque la venta sea anterior.
  const co = await traerTodo(() => deEl(supabase.from('ventas').select('*')).gte('cuota_fecha', desde).lte('cuota_fecha', hasta).in('cuota_estado', ['reportada', 'confirmada']).order('cuota_fecha'))
  const fallo = pr.error ?? ve.error ?? vi.error ?? as.error ?? co.error
  if (fallo) throw new Error(traducirError(fallo))
  // Sin la migración 011 la tabla de entregas no existe: el formato sale vacío.
  return { cobros: co.data, prospectos: pr.data, ventas: ve.data, visitas: vi.data, asistencias: as.data, entregas: en.error ? null : en.data }
}

// Encabezado como el del formato de papel; devuelve dónde empieza la tabla.
function encabezado(doc, titulo_, lineas) {
  const ancho = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...AZUL)
  doc.text(titulo_, ancho / 2, 16, { align: 'center' })
  doc.setFontSize(9.5)
  doc.setTextColor(40, 40, 40)
  let y = 25
  for (const fila of lineas) {
    let xx = 14
    for (const [etiqueta, valor] of fila) {
      doc.setFont('helvetica', 'bold')
      doc.text(`${etiqueta}:`, xx, y)
      const w = doc.getTextWidth(`${etiqueta}:`) + 2
      doc.setFont('helvetica', 'normal')
      doc.text(String(valor || '—'), xx + w, y)
      xx += (ancho - 28) / fila.length
    }
    y += 6
  }
  return y + 1
}

function pies(doc, generado) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.text(`Generado con LX Ventas el ${generado}`, 14, h - 7)
    doc.text(`Página ${i} de ${n}`, w - 14, h - 7, { align: 'right' })
  }
}

function tabla(autoTable, doc, y, cabeza, filas, opciones = {}) {
  autoTable(doc, {
    startY: y,
    head: [cabeza],
    body: filas.length ? filas : [cabeza.map((_, i) => (i === 1 ? 'Sin registros en estas fechas' : ''))],
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, lineColor: [150, 150, 150], lineWidth: 0.2, textColor: [30, 30, 30], valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
    ...opciones,
  })
  return doc.lastAutoTable.finalY
}

// Genera el PDF de un formato para un asesor entre dos fechas. Devuelve { blob, nombre, filas }.
export async function generarFormato({ formato, asesor, zona, desde, hasta, cfg, empresa }) {
  const [{ jsPDF }, { default: autoTable }, d] = await Promise.all([import('jspdf'), import('jspdf-autotable'), traer(asesor.id, desde, hasta)])
  const def = FORMATOS.find((f) => f.id === formato)
  const doc = new jsPDF({ orientation: def.hoja === 'l' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const nombre = titulo(asesor.nombre)
  const ugel = zona?.nombre ? titulo(zona.nombre) : ''
  const nz = (cfg?.nombre_zona ?? 'UGEL').toUpperCase()
  const rango = desde === hasta ? `${titulo(diaSemana(desde))} ${fecha(desde)}` : `Del ${fecha(desde)} al ${fecha(hasta)}`
  const producto = cfg?.producto ?? ''
  const ventaDe = Object.fromEntries(d.ventas.filter((v) => v.prospecto_id).map((v) => [v.prospecto_id, v]))
  let filas = 0

  const filaPersona = (p, i) => {
    const v = ventaDe[p.id]
    return [i + 1, fecha(fechaDeMarca(p.creado_en)), horaCorta(horaDeMarca(p.creado_en)), titulo(p.nombre), x(p.interes === 'bajo'), x(p.interes === 'medio'), x(p.interes === 'alto'), p.lugar ?? '', titulo(v?.estrategia ?? ''), titulo(p.condicion ?? ''), titulo(v?.programa ?? producto)]
  }
  const centrar = (cols) => Object.fromEntries(cols.map((c) => [c, { halign: 'center' }]))

  if (formato === 'ipd' || formato === 'interesados') {
    const lista = formato === 'ipd' ? d.prospectos : d.prospectos.filter((p) => p.estado === 'abierto' || p.estado === 'pausado')
    filas = lista.length
    const y = encabezado(doc, formato === 'ipd' ? 'INFORME DE PRODUCCIÓN DIARIA (I.P.D.)' : 'REPORTE DE INTERESADOS', [[['NOMBRE Y APELLIDOS', nombre], [nz, ugel], ['FECHA', rango]]])
    const cabeza = formato === 'ipd'
      ? ['ORD', 'FECHA', 'HORA', 'NOMBRES Y APELLIDOS', 'FRÍO', 'TIBIO', 'CALIENTE', 'I.E. DONDE LABORA', 'ESTRATEGIA DE VENTA', 'CONDICIÓN TRABAJO', 'PRODUCTO MOSTRADO', 'CELULAR', 'PRÓXIMA VISITA', 'OBSERVACIÓN']
      : ['ORD.', 'FECHA', 'HORA', 'NOMBRE Y APELLIDOS', 'FRÍO', 'TIBIO', 'CALIENTE', 'I.E. DONDE LABORA', 'ESTRATEGIA DE VENTA', 'COND. TRABAJO', 'PRODUCTO MOSTRADO', 'BASE DE DATOS', 'PRÓXIMA VISITA', 'OBSERVACIÓN']
    const cuerpo = lista.map((p, i) => [
      ...filaPersona(p, i),
      formato === 'ipd' ? p.celular ?? '' : p.referido_por ? `Referido por ${titulo(p.referido_por)}` : 'Visita a colegio',
      p.estado === 'abierto' ? fecha(p.proximo_contacto) : '',
      formato === 'ipd' ? unir(RESULTADO[p.estado], p.comentario) : unir(p.celular, p.comentario),
    ])
    const ancho = [9, 18, 18, 36, 10, 11, 15, 32, 22, 19, 22, 19, 18]
    tabla(autoTable, doc, y, cabeza, cuerpo, {
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 6.5, cellPadding: 1.2 },
      columnStyles: Object.fromEntries(ancho.map((w, i) => [i, { cellWidth: w, halign: [0, 1, 2, 4, 5, 6, 11, 12].includes(i) ? 'center' : 'left' }])),
    })
  }

  if (formato === 'ventas') {
    filas = d.ventas.length
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    const mes = `${meses[Number(hasta.slice(5, 7)) - 1]} ${hasta.slice(0, 4)}`
    const y = encabezado(doc, 'REPORTE DE VENTAS', [[['ASESOR(A)', nombre], [nz, ugel], ['MES', mes]], [['FECHAS', rango]]])
    const cuerpo = d.ventas.map((v, i) => {
      const pagada = v.cuota_estado === 'reportada' || v.cuota_estado === 'confirmada'
      return [i + 1, titulo(v.nombre), titulo(v.programa ?? ''), fecha(v.fecha), titulo(v.condicion ?? ''), titulo(v.pago ?? ''), pagada ? fecha(v.cuota_fecha) : v.cuota_compromiso ? `Se comprometió: ${fecha(v.cuota_compromiso)}` : '', nombre, estadoVenta(v, cfg)[1]]
    })
    tabla(autoTable, doc, y, ['N°', 'NOMBRE Y APELLIDOS', 'PROGRAMA', 'FECHA DE CONTRATO', 'CONDICIÓN LABORAL', 'MEDIO DE PAGO', 'FECHA DE PAGO MENSUALIDAD', 'ASESORA', 'ESTADO'], cuerpo, { columnStyles: { ...centrar([0, 3, 6]), 1: { cellWidth: 50 } } })
  }

  if (formato === 'merchandising') {
    const lista = d.entregas ?? []
    filas = lista.length
    const y = encabezado(doc, 'CONTROL DE ENTREGA MERCHANDISING', [[['ASESOR(A)', nombre], [nz, ugel], ['FECHA', rango]]])
    const cuerpo = lista.map((e, i) => [i + 1, titulo(e.nombre), e.celular ?? '', e.lugar ?? '', titulo(e.producto), e.cantidad, fecha(e.fecha), horaCorta(e.hora), titulo(e.observacion ?? '')])
    const fin = tabla(autoTable, doc, y, ['N°', 'NOMBRE Y APELLIDO', 'CELULAR', 'INSTITUCIÓN EDUCATIVA', 'PRODUCTO', 'CANTIDAD', 'FECHA', 'HORA', 'OBSERVACIÓN'], cuerpo, { columnStyles: { ...centrar([0, 2, 5, 6, 7]), 1: { cellWidth: 50 }, 3: { cellWidth: 48 } } })
    if (d.entregas === null) {
      doc.setFontSize(8.5)
      doc.setTextColor(150, 60, 0)
      doc.text('Las entregas de merchandising todavía no están activadas en el sistema.', 14, fin + 8)
    }
  }

  if (formato === 'planilla') {
    const ingreso = BASICO[asesor.rol] ?? BASICO.asesor
    const y0 = encabezado(doc, 'PLANILLA DEL ASESOR', [
      [['NOMBRE Y APELLIDOS', nombre]],
      [['DNI', asesor.dni ?? ''], ['INGRESO MENSUAL', `S/ ${ingreso.toLocaleString('es-PE')}.00`]],
      [['FECHA DE INICIO', fecha(desde)], ['FECHA DE TÉRMINO', fecha(hasta)]],
    ])
    const cuerpo = []
    let dias = 0
    let movTotal = 0
    for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
      const dow = new Date(`${dia}T12:00:00`).getDay()
      const a = d.asistencias.find((x2) => x2.fecha === dia)
      if (dow === 0 && !a) continue
      const vis = d.visitas.filter((v) => v.fecha === dia)
      const mov = vis.reduce((s, v) => s + (v.movilidad_centimos ?? 0), 0)
      const ven = d.ventas.filter((v) => v.fecha === dia).length
      const reg = d.prospectos.filter((p) => fechaDeMarca(p.creado_en) === dia).length
      const jornada = !a?.hora_ingreso ? '' : dow === 6 || (a.hora_salida && a.hora_salida <= '13:30') ? 'Medio día' : 'Todo el día'
      if (a?.hora_ingreso) dias++
      movTotal += mov
      cuerpo.push([horaCorta(a?.hora_ingreso), horaCorta(a?.hora_salida), titulo(diaSemana(dia)), fecha(dia), jornada, a?.hora_ingreso || vis.length ? unir(vis.length && `${vis.length} colegios`, reg && `${reg} registrados`, ven && `${ven} ${ven === 1 ? 'venta' : 'ventas'}`) || 'Sin registros' : '', mov ? soles(mov) : '', ''])
    }
    filas = dias
    const fin = tabla(autoTable, doc, y0, ['HORA DE INGRESO', 'HORA DE SALIDA', 'DÍA', 'FECHA', 'JORNADA (TODO EL DÍA O MEDIO DÍA)', 'RESULTADO DEL DÍA', 'MOVILIDAD', 'ADELANTO (+/-)'], cuerpo, {
      columnStyles: { ...centrar([0, 1, 3, 4, 6]), 5: { cellWidth: 48 } },
      foot: [['', '', '', 'TOTAL', `${dias} días con ingreso`, '', soles(movTotal), '']],
      footStyles: { fillColor: [230, 238, 245], textColor: [23, 55, 90], fontStyle: 'bold', halign: 'center' },
    })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(60, 60, 60)
    const nota = 'NOTA: En los casos de tener días no trabajados durante su periodo mensual, la empresa abonará solo los días trabajados, utilizando la siguiente fórmula: se divide el valor del ingreso mensual entre los 30 días del periodo mensual, saliendo como resultado el valor por cada día de trabajo, y este resultado se multiplicará por los días trabajados, dando como resultado el monto a pagar. Así mismo, si se retira antes de la fecha de término de mes, la empresa abonará su correspondiente pago el día de la fecha de culminación de mes (sin excepciones).'
    doc.text(doc.splitTextToSize(nota, doc.internal.pageSize.getWidth() - 28), 14, Math.min(fin + 8, doc.internal.pageSize.getHeight() - 30))
  }

  if (formato === 'caja') {
    const dias = [...new Set([...d.cobros.map((v) => v.cuota_fecha), ...d.visitas.filter((v) => v.movilidad_centimos > 0).map((v) => v.fecha)])].sort()
    if (!dias.length) dias.push(desde)
    dias.forEach((dia, k) => {
      if (k > 0) doc.addPage()
      const y = encabezado(doc, 'CAJA DIARIA', [[['NOMBRE Y APELLIDOS', nombre]], [['DÍA Y FECHA', `${titulo(diaSemana(dia))} ${fecha(dia)}`], [nz, ugel]]])
      const ing = d.cobros.filter((v) => v.cuota_fecha === dia).map((v) => [`1.ª mensualidad de ${titulo(v.nombre)}${v.cuota_medio ? ' (' + titulo(v.cuota_medio) + (v.cuota_operacion ? ' · op. ' + v.cuota_operacion : '') + ')' : ''}${v.cuota_estado === 'confirmada' ? '' : ' · por confirmar'}`, v.cuota_centimos ?? cfg?.primera_cuota_centimos ?? 13000, 0])
      const egr = d.visitas.filter((v) => v.fecha === dia && v.movilidad_centimos > 0).map((v) => [`Movilidad · visita a ${v.lugar}`, 0, v.movilidad_centimos])
      const lineas = [...ing, ...egr]
      filas += lineas.length
      const ti = lineas.reduce((t, l) => t + l[1], 0)
      const te = lineas.reduce((t, l) => t + l[2], 0)
      tabla(autoTable, doc, y, ['DETALLE', 'INGRESOS', 'EGRESOS'], lineas.map((l) => [l[0], l[1] ? soles(l[1]) : '', l[2] ? soles(l[2]) : '']), {
        styles: { fontSize: 9, cellPadding: 2.2, lineColor: [150, 150, 150], lineWidth: 0.2 },
        columnStyles: { 1: { cellWidth: 32, halign: 'right' }, 2: { cellWidth: 32, halign: 'right' } },
        foot: [['TOTAL', soles(ti), soles(te)], ['CAJA (ingresos - egresos)', soles(ti - te), '']],
        footStyles: { fillColor: [230, 238, 245], textColor: [23, 55, 90], fontStyle: 'bold', halign: 'right' },
      })
    })
  }

  if (formato === 'actividades') {
    const hechos = []
    const anotar = (dia, hora, actividad) => hechos.push({ dia, hora: hora ?? '', actividad })
    for (const a of d.asistencias) {
      if (a.hora_ingreso) anotar(a.fecha, a.hora_ingreso, `Marcó su ingreso${a.lat_ingreso ? ' (con ubicación)' : ''}`)
      if (a.hora_salida) anotar(a.fecha, a.hora_salida, 'Marcó su salida')
    }
    for (const v of d.visitas) anotar(v.fecha, v.hora, unir(`Visita a ${v.lugar}: ${titulo(v.resultado).toLowerCase()}`, v.director && `director(a) ${titulo(v.director)}`, v.contactos > 0 && `${v.contactos} docentes atendidos`, v.movilidad_centimos > 0 && `movilidad ${soles(v.movilidad_centimos)}`))
    for (const p of d.prospectos) anotar(fechaDeMarca(p.creado_en), horaDeMarca(p.creado_en), unir(`Registró a ${titulo(p.nombre)}`, p.lugar, (RESULTADO[p.estado] ?? '').toLowerCase()))
    for (const v of d.ventas) anotar(v.fecha, v.hora, unir(`Venta a ${titulo(v.nombre)}`, titulo(v.programa ?? ''), estadoVenta(v, cfg)[1].toLowerCase()))
    for (const e of d.entregas ?? []) anotar(e.fecha, e.hora, `Entregó ${e.cantidad} ${titulo(e.producto).toLowerCase()} a ${titulo(e.nombre)}`)
    hechos.sort((a, b) => a.dia.localeCompare(b.dia) || a.hora.localeCompare(b.hora))
    filas = hechos.length
    const dias = [...new Set(hechos.map((h) => h.dia))]
    if (!dias.length) dias.push(desde)
    dias.forEach((dia, k) => {
      if (k > 0) doc.addPage()
      const y = encabezado(doc, 'ACTIVIDADES DIARIAS', [[['NOMBRE Y APELLIDOS', nombre]], [['DÍA / FECHA', `${titulo(diaSemana(dia))} ${fecha(dia)}`], [nz, ugel]]])
      tabla(autoTable, doc, y, ['HORA', 'ACTIVIDAD'], hechos.filter((h) => h.dia === dia).map((h) => [horaCorta(h.hora), h.actividad]), { styles: { fontSize: 9, cellPadding: 2.2, lineColor: [150, 150, 150], lineWidth: 0.2 }, columnStyles: { 0: { cellWidth: 24, halign: 'center' } } })
    })
  }

  const ahora = new Date()
  pies(doc, `${fecha(ahora.toLocaleDateString('en-CA'))} ${horaCorta(`${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2, '0')}`)}${empresa ? ' · ' + empresa : ''}`)
  const base = `${def.archivo} - ${nombre} - ${desde === hasta ? fecha(desde).replaceAll('/', '-') : `${fecha(desde).replaceAll('/', '-')} al ${fecha(hasta).replaceAll('/', '-')}`}`
  return { blob: doc.output('blob'), nombre: `${base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.pdf`, filas }
}

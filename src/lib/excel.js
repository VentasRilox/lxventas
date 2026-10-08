// Descarga en Excel de lo registrado entre dos fechas, con hojas parecidas a
// los formatos de papel de la empresa (IPD, reporte de ventas, interesados,
// actividades diarias). La librería se carga recién al descargar.
import { supabase, traerTodo } from './supabase'
import { traducirError } from './errores'
import { diaSemana, fechaDeMarca, horaCorta, horaDeMarca } from './fecha'
import { esCaida, estadoVenta, montoCuota, titulo } from './reglas'

const CARGO = { asesor: 'Asesor', supervisor: 'Supervisor', jefe: 'Jefe de ventas', gerencia: 'Gerencia' }
const RESULTADO = { abierto: 'En seguimiento', ganado: 'Compró', perdido: 'No compró', pausado: 'Para más adelante' }
const TINTA = 'FF14213D'

// '2026-10-05' → '05/10/2026'
function fecha(iso) {
  const p = String(iso ?? '').slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''
}

const x = (si) => (si ? 'X' : '')
const texto = (...partes) => partes.filter(Boolean).join(' · ')

async function traer(desde, hasta) {
  // Perú no cambia de hora: el día va de 00:00 a 23:59 con -05:00.
  const [ventas, visitas, prospectos, asistencias] = await Promise.all([
    traerTodo(() => supabase.from('ventas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en')),
    traerTodo(() => supabase.from('visitas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('creado_en')),
    traerTodo(() => supabase.from('prospectos').select('*').gte('creado_en', `${desde}T00:00:00-05:00`).lte('creado_en', `${hasta}T23:59:59-05:00`).order('creado_en')),
    traerTodo(() => supabase.from('asistencias').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha')),
  ])
  const fallo = ventas.error ?? visitas.error ?? prospectos.error ?? asistencias.error
  if (fallo) throw new Error(traducirError(fallo))
  return { ventas: ventas.data, visitas: visitas.data, prospectos: prospectos.data, asistencias: asistencias.data }
}

// Arma una hoja: título, rango de fechas, encabezados y filas con bordes.
function hoja(libro, nombre, tituloHoja, subtitulo, columnas, filas) {
  const h = libro.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  })
  h.columns = columnas.map((c) => ({ width: c.w }))
  const n = columnas.length

  h.mergeCells(1, 1, 1, n)
  h.getCell(1, 1).value = tituloHoja
  h.getCell(1, 1).font = { bold: true, size: 14, color: { argb: TINTA } }
  h.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' }
  h.getRow(1).height = 24

  h.mergeCells(2, 1, 2, n)
  h.getCell(2, 1).value = subtitulo
  h.getCell(2, 1).font = { size: 10, color: { argb: 'FF555555' } }
  h.getCell(2, 1).alignment = { horizontal: 'center' }

  const borde = { style: 'thin', color: { argb: 'FF999999' } }
  const marco = { top: borde, left: borde, bottom: borde, right: borde }
  const cab = h.getRow(3)
  cab.height = 32
  columnas.forEach((c, i) => {
    const celda = cab.getCell(i + 1)
    celda.value = c.t
    celda.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.extra ? 'FF5B6B8C' : TINTA } }
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    celda.border = marco
  })

  const datos = filas.length ? filas : [columnas.map((_, i) => (i === 1 ? 'Sin registros en estas fechas' : ''))]
  datos.forEach((fila, f) => {
    const r = h.getRow(4 + f)
    fila.forEach((valor, i) => {
      const celda = r.getCell(i + 1)
      celda.value = valor ?? ''
      celda.border = marco
      celda.font = { size: 10 }
      celda.alignment = { vertical: 'top', wrapText: true, horizontal: columnas[i].c ? 'center' : 'left' }
      if (columnas[i].soles && typeof valor === 'number') celda.numFmt = '"S/" #,##0.00'
    })
  })
  h.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } }
  h.pageSetup.printTitlesRow = '3:3'
  return h
}

export async function descargarExcel({ desde, hasta, perfiles, zonas, cfg, empresa }) {
  const [{ default: ExcelJS }, d] = await Promise.all([import('exceljs'), traer(desde, hasta)])

  const persona = Object.fromEntries(perfiles.map((p) => [p.id, p]))
  const nombreDe = (id) => titulo(persona[id]?.nombre ?? '')
  const cargoDe = (id) => CARGO[persona[id]?.rol] ?? ''
  const zonaDe = (id) => zonas.find((z) => z.id === id)?.nombre ?? ''
  const ventaDe = Object.fromEntries(d.ventas.filter((v) => v.prospecto_id).map((v) => [v.prospecto_id, v]))
  const producto = cfg?.producto ?? ''
  const rango = `Del ${fecha(desde)} al ${fecha(hasta)}${empresa ? ' · ' + empresa : ''}`

  const libro = new ExcelJS.Workbook()
  libro.creator = 'LX Ventas'
  libro.created = new Date()

  // ---- 1. Informe de producción diaria: toda persona con la que se habló.
  const filaPersona = (p, i) => {
    const v = ventaDe[p.id]
    return [
      i + 1,
      fecha(fechaDeMarca(p.creado_en)),
      horaCorta(horaDeMarca(p.creado_en)),
      titulo(p.nombre),
      x(p.interes === 'bajo'),
      x(p.interes === 'medio'),
      x(p.interes === 'alto'),
      p.lugar ?? '',
      titulo(v?.estrategia ?? ''),
      titulo(p.condicion ?? ''),
      titulo(v?.programa ?? producto),
    ]
  }
  hoja(
    libro,
    'IPD',
    'INFORME DE PRODUCCIÓN DIARIA (I.P.D.)',
    rango,
    [
      { t: 'ORD', w: 5, c: 1 }, { t: 'FECHA', w: 11, c: 1 }, { t: 'HORA', w: 10, c: 1 }, { t: 'NOMBRES Y APELLIDOS', w: 30 },
      { t: 'FRÍO', w: 6, c: 1 }, { t: 'TIBIO', w: 6, c: 1 }, { t: 'CALIENTE', w: 9, c: 1 },
      { t: 'I.E. DONDE LABORA', w: 26 }, { t: 'ESTRATEGIA DE VENTA', w: 16 }, { t: 'CONDICIÓN TRABAJO', w: 13 }, { t: 'PRODUCTO MOSTRADO', w: 22 },
      { t: 'CELULAR', w: 12, c: 1 }, { t: 'PRÓXIMA VISITA', w: 12, c: 1 }, { t: 'OBSERVACIÓN', w: 30 },
      { t: 'PUESTO', w: 11, extra: 1 }, { t: 'RESULTADO', w: 15, extra: 1 }, { t: 'ASESOR(A)', w: 22, extra: 1 }, { t: cfg?.nombre_zona?.toUpperCase() ?? 'ZONA', w: 14, extra: 1 },
    ],
    d.prospectos.map((p, i) => [
      ...filaPersona(p, i),
      p.celular ?? '',
      p.estado === 'abierto' ? fecha(p.proximo_contacto) : '',
      texto(p.comentario, p.referido_por && `Referido por ${titulo(p.referido_por)}`),
      titulo(p.puesto ?? ''),
      RESULTADO[p.estado] ?? '',
      nombreDe(p.asesor_id),
      zonaDe(p.zona_id),
    ])
  )

  // ---- 2. Reporte de ventas (anexo 8): una fila por contrato.
  hoja(
    libro,
    'Reporte de ventas',
    'REPORTE DE VENTAS',
    rango,
    [
      { t: 'N°', w: 5, c: 1 }, { t: 'NOMBRE Y APELLIDOS', w: 30 }, { t: 'PROGRAMA', w: 24 }, { t: 'FECHA DE CONTRATO', w: 12, c: 1 },
      { t: 'CONDICIÓN LABORAL', w: 13 }, { t: 'MEDIO DE PAGO', w: 20 }, { t: 'FECHA DE PAGO MENSUALIDAD', w: 16, c: 1 }, { t: 'ASESOR(A)', w: 22 },
      { t: 'ESTADO', w: 17, extra: 1 }, { t: '1RA MENSUALIDAD', w: 13, soles: 1, extra: 1 }, { t: 'PAGÓ POR', w: 16, extra: 1 },
      { t: 'DNI', w: 11, c: 1, extra: 1 }, { t: 'CELULAR', w: 12, c: 1, extra: 1 }, { t: 'I.E.', w: 26, extra: 1 }, { t: cfg?.nombre_zona?.toUpperCase() ?? 'ZONA', w: 14, extra: 1 },
    ],
    d.ventas.map((v, i) => {
      const pagada = v.cuota_estado === 'reportada' || v.cuota_estado === 'confirmada'
      return [
        i + 1,
        titulo(v.nombre),
        titulo(v.programa ?? ''),
        fecha(v.fecha),
        titulo(v.condicion ?? ''),
        titulo(v.pago ?? ''),
        pagada ? fecha(v.cuota_fecha) : v.cuota_compromiso && !esCaida(v) ? `Se comprometió: ${fecha(v.cuota_compromiso)}` : '',
        nombreDe(v.asesor_id),
        estadoVenta(v, cfg)[1],
        pagada ? montoCuota(v, cfg) / 100 : '',
        pagada ? titulo(v.cuota_medio ?? '') : '',
        v.dni ?? '',
        v.celular ?? '',
        v.lugar ?? '',
        zonaDe(v.zona_id),
      ]
    })
  )

  // ---- 3. Reporte de interesados: quienes siguen en seguimiento.
  const interesados = d.prospectos.filter((p) => p.estado === 'abierto' || p.estado === 'pausado')
  hoja(
    libro,
    'Interesados',
    'REPORTE DE INTERESADOS',
    rango,
    [
      { t: 'ORD.', w: 5, c: 1 }, { t: 'FECHA', w: 11, c: 1 }, { t: 'HORA', w: 10, c: 1 }, { t: 'NOMBRE Y APELLIDOS', w: 30 },
      { t: 'FRÍO', w: 6, c: 1 }, { t: 'TIBIO', w: 6, c: 1 }, { t: 'CALIENTE', w: 9, c: 1 },
      { t: 'I.E. DONDE LABORA', w: 26 }, { t: 'ESTRATEGIA DE VENTA', w: 16 }, { t: 'COND. TRABAJO', w: 13 }, { t: 'PRODUCTO MOSTRADO', w: 22 },
      { t: 'BASE DE DATOS', w: 18 }, { t: 'PRÓXIMA VISITA', w: 12, c: 1 }, { t: 'OBSERVACIÓN', w: 30 },
      { t: 'CELULAR', w: 12, c: 1, extra: 1 }, { t: 'CONTACTO N°', w: 10, c: 1, extra: 1 }, { t: 'ASESOR(A)', w: 22, extra: 1 }, { t: cfg?.nombre_zona?.toUpperCase() ?? 'ZONA', w: 14, extra: 1 },
    ],
    interesados.map((p, i) => [
      ...filaPersona(p, i),
      p.referido_por ? `Referido por ${titulo(p.referido_por)}` : 'Visita a colegio',
      fecha(p.proximo_contacto),
      p.comentario ?? '',
      p.celular ?? '',
      p.paso ?? '',
      nombreDe(p.asesor_id),
      zonaDe(p.zona_id),
    ])
  )

  // ---- 4. Visitas a colegios, con director y movilidad.
  hoja(
    libro,
    'Colegios visitados',
    'VISITAS A COLEGIOS',
    rango,
    [
      { t: 'N°', w: 5, c: 1 }, { t: 'FECHA', w: 11, c: 1 }, { t: 'HORA', w: 10, c: 1 }, { t: 'I.E.', w: 28 }, { t: 'RESULTADO', w: 20 },
      { t: 'DIRECTOR(A)', w: 24 }, { t: 'CELULAR', w: 12, c: 1 }, { t: 'NIVELES', w: 16 }, { t: 'DOCENTES ATENDIDOS', w: 11, c: 1 }, { t: 'VENTAS', w: 8, c: 1 },
      { t: 'MOVILIDAD', w: 11, soles: 1 }, { t: 'DIRECCIÓN', w: 26 }, { t: 'REFERENCIA', w: 22 }, { t: 'OBSERVACIÓN', w: 30 },
      { t: 'REGISTRÓ', w: 22 }, { t: 'CARGO', w: 12 }, { t: cfg?.nombre_zona?.toUpperCase() ?? 'ZONA', w: 14 },
    ],
    d.visitas.map((v, i) => [
      i + 1, fecha(v.fecha), horaCorta(v.hora), v.lugar, titulo(v.resultado), titulo(v.director ?? ''), v.celular ?? '', titulo(v.niveles ?? ''),
      v.contactos ?? 0, v.ventas_declaradas ?? 0, (v.movilidad_centimos ?? 0) / 100, titulo(v.direccion ?? ''), titulo(v.referencia ?? ''), titulo(v.observacion ?? ''),
      nombreDe(v.asesor_id), cargoDe(v.asesor_id), zonaDe(v.zona_id),
    ])
  )

  // ---- 5. Actividades diarias: lo que hizo cada persona, hora por hora.
  const hechos = []
  const anotar = (dia, quien, hora, actividad) => hechos.push({ dia, quien, hora: hora ?? '', actividad })
  for (const a of d.asistencias) {
    if (a.hora_ingreso) anotar(a.fecha, a.asesor_id, a.hora_ingreso, 'Marcó su ingreso')
    if (a.hora_salida) anotar(a.fecha, a.asesor_id, a.hora_salida, 'Marcó su salida')
  }
  for (const v of d.visitas) {
    anotar(v.fecha, v.asesor_id, v.hora, texto(`Visita a ${v.lugar}: ${titulo(v.resultado).toLowerCase()}`, v.director && `director(a) ${titulo(v.director)}`, v.contactos > 0 && `${v.contactos} atendidos`, v.movilidad_centimos > 0 && `movilidad S/ ${(v.movilidad_centimos / 100).toFixed(2)}`))
  }
  for (const p of d.prospectos) {
    anotar(fechaDeMarca(p.creado_en), p.asesor_id, horaDeMarca(p.creado_en), texto(`Registró a ${titulo(p.nombre)}`, p.lugar, (RESULTADO[p.estado] ?? '').toLowerCase()))
  }
  for (const v of d.ventas) {
    anotar(v.fecha, v.asesor_id, v.hora, texto(`Venta a ${titulo(v.nombre)}`, titulo(v.programa ?? ''), estadoVenta(v, cfg)[1].toLowerCase()))
  }
  hechos.sort((a, b) => a.dia.localeCompare(b.dia) || nombreDe(a.quien).localeCompare(nombreDe(b.quien)) || a.hora.localeCompare(b.hora))
  hoja(
    libro,
    'Actividades diarias',
    'ACTIVIDADES DIARIAS',
    rango,
    [{ t: 'DÍA', w: 11, c: 1 }, { t: 'FECHA', w: 11, c: 1 }, { t: 'NOMBRE Y APELLIDOS', w: 26 }, { t: 'CARGO', w: 13 }, { t: 'HORA', w: 10, c: 1 }, { t: 'ACTIVIDAD', w: 80 }],
    hechos.map((e) => [titulo(diaSemana(e.dia)), fecha(e.dia), nombreDe(e.quien), cargoDe(e.quien), horaCorta(e.hora), e.actividad])
  )

  const datos = await libro.xlsx.writeBuffer()
  const archivo = new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(archivo)
  enlace.download = `Reportes LX Ventas ${desde} a ${hasta}.xlsx`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(enlace.href), 60000)
  return { personas: d.prospectos.length, ventas: d.ventas.length, visitas: d.visitas.length }
}

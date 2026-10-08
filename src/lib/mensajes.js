import { diaSemana, fechaMensaje, horaMensaje, sumarDias, fechaLocalHoy, finDeMes, mesDe } from './fecha'
import { mayus, visitaConIngreso } from './reglas'

export function enlaceWhatsApp(texto, celular) {
  const numero = String(celular ?? '').replace(/\D/g, '')
  const destino = numero.length === 9 ? `51${numero}` : numero
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}

// Reporte de visita, en el formato que la empresa usa en su grupo de WhatsApp.
export function textoVisita(f, ctx) {
  const sin = !visitaConIngreso(f.resultado)
  return [
    'RESULTADO DE LA VISITA: ' + mayus(f.resultado),
    'N° ' + mayus(f.numero),
    'I.E: ' + mayus(f.lugar),
    'DIRECTOR(A): ' + mayus(f.director),
    'CELULAR: ' + mayus(f.celular),
    'DIA: ' + diaSemana(f.fecha),
    'FECHA: ' + fechaMensaje(f.fecha, '/'),
    'HORA: ' + horaMensaje(f.hora),
    'NIVELES: ' + mayus(sin ? '' : f.niveles),
    !ctx.supervisor && 'TOTAL DE DOCENTES: ' + (sin ? 'CERO' : mayus(f.contactos) || '0'),
    'DIRECCIÓN: ' + mayus(f.direccion),
    'REFERENCIA: ' + mayus(f.referencia),
    'ZONA: ' + mayus(ctx.zona),
    'UGEL: ' + mayus(ctx.zona),
    (ctx.supervisor ? 'PASAJES: ' : 'MOVILIDAD: ') + (mayus(f.movilidad) || '0'),
    !ctx.supervisor && 'VENTA: ' + (sin ? 'CERO' : mayus(f.ventas_declaradas) || '0'),
    (ctx.supervisor ? 'SUPERVISOR(A): ' : 'ASESOR(A): ') + mayus(ctx.asesor),
    !ctx.supervisor && 'PSI: ' + mayus(sin ? '' : f.psi),
    '',
    'OBSERVACIÓN: ' + mayus(f.observacion),
    mayus(ctx.firma),
  ].filter((l) => l !== false).join('\n')
}

// Cierre de venta, en el formato de la empresa.
export function textoVenta(f, ctx) {
  return [
    '📍 ASESOR: ' + mayus(ctx.asesor),
    '📍 DIA Y FECHA: ' + diaSemana(f.fecha) + ' ' + fechaMensaje(f.fecha, '-') + ' HORA: ' + horaMensaje(f.hora),
    'VENTA ' + mayus(ctx.firma),
    'ESTRATEGIA: ' + mayus(f.estrategia),
    'PROGRAMA DE ESTUDIO: ' + mayus(f.programa),
    '✅ NOMBRE COMPLETO: ' + mayus(f.nombre),
    '✅ DNI: ' + mayus(f.dni),
    '✅ DESEMPEÑO: ' + mayus(f.desempeno),
    '✅ UGEL: ' + mayus(ctx.zona),
    '✅ CEL: ' + mayus(f.celular),
    '✅ CORREO ELECTRÓNICO: ' + String(f.correo ?? '').trim().toLowerCase(),
    '- CONDICIÓN LABORAL: ' + mayus(f.condicion),
    '- I.E: ' + mayus(f.lugar),
    '✅ SUSCRIPCION: ' + (mayus(f.suscripcion) || '----------'),
    '✅ MODALIDAD DE PAGO: ' + mayus(f.pago),
    '✅ *BENEFICIARIO*: ' + mayus(f.beneficiario),
    '✅ 1RA MENSUALIDAD: ' + (f.cuota === 'Ya pagó' ? 'PAGADA' + (f.cuota_medio ? ' POR ' + mayus(f.cuota_medio) : '') + (f.cuota_operacion ? ' · OP. ' + mayus(f.cuota_operacion) : '') : 'PENDIENTE' + (f.cuota_compromiso ? ' · SE COMPROMETE A PAGAR EL ' + fechaMensaje(f.cuota_compromiso, '/') : '')),
    'OBSERVACIÓN: ' + mayus(f.observacion),
  ].join('\n')
}

// Próxima fecha de corte de planilla, a partir del día configurado.
export function fechaCorteTexto(cfg, hoy = fechaLocalHoy()) {
  const dia = cfg?.dia_corte_planilla
  if (!dia) return 'fin de mes'
  const fin = finDeMes(mesDe(hoy))
  const tope = Math.min(dia, Number(fin.slice(8)))
  let corte = `${mesDe(hoy)}-${String(tope).padStart(2, '0')}`
  if (corte < hoy) {
    const siguiente = mesDe(sumarDias(fin, 1))
    const finSig = finDeMes(siguiente)
    corte = `${siguiente}-${String(Math.min(dia, Number(finSig.slice(8)))).padStart(2, '0')}`
  }
  return fechaMensaje(corte, '/')
}

// Elige la plantilla del paso: primero la del motivo de duda, luego la general.
export function plantillaPara(plantillas, paso, motivo) {
  const activas = (plantillas ?? []).filter((p) => p.activa && p.paso === paso)
  return activas.find((p) => p.motivo && p.motivo === motivo) ?? activas.find((p) => !p.motivo) ?? null
}

export function llenarPlantilla(texto, datos) {
  return String(texto ?? '').replace(/\{(\w+)\}/g, (todo, clave) =>
    datos[clave] !== undefined && datos[clave] !== null && datos[clave] !== '' ? datos[clave] : todo
  )
}

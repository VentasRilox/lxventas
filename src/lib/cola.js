import { supabase } from './supabase'
import { esErrorDeRed } from './errores'

// Cola de registros que no se pudieron enviar por falta de señal. Cada registro
// lleva su idem_key, así que reenviarlo nunca lo duplica. Es la única excepción
// a "no guardar datos de negocio en el celular": dura hasta que vuelve la señal.
const CLAVE = 'lxv_cola'

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
  } catch {
    return []
  }
}

function escribir(cola) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola))
  } catch {
    // Sin almacenamiento disponible: el registro se pierde si no hay señal.
  }
  window.dispatchEvent(new Event('lxv-cola'))
}

export function pendientes() {
  return leer().length
}

async function enviar(tabla, fila) {
  return supabase.from(tabla).upsert(fila, { onConflict: 'empresa_id,idem_key' }).select('id').maybeSingle()
}

// Guarda un registro. Sin señal lo deja en cola y responde pendiente: true.
export async function guardarRegistro(tabla, fila) {
  let fallo
  try {
    const { data, error } = await enviar(tabla, fila)
    if (!error) return { ok: true, id: data?.id ?? null }
    fallo = error
  } catch (e) {
    fallo = e
  }
  if (!esErrorDeRed(fallo)) return { ok: false, error: fallo }
  const cola = leer().filter((x) => !(x.tabla === tabla && x.fila.idem_key === fila.idem_key))
  cola.push({ tabla, fila })
  escribir(cola)
  return { ok: true, pendiente: true }
}

let enviando = false

export async function vaciarCola() {
  if (enviando) return
  enviando = true
  try {
    for (const item of leer()) {
      let fallo = null
      try {
        const { error } = await enviar(item.tabla, item.fila)
        fallo = error
      } catch (e) {
        fallo = e
      }
      if (fallo && esErrorDeRed(fallo)) break
      // Enviado, o rechazado por la base (no tiene sentido reintentar): sale de la cola.
      if (fallo) console.error('Registro en cola rechazado', fallo)
      escribir(leer().filter((x) => !(x.tabla === item.tabla && x.fila.idem_key === item.fila.idem_key)))
    }
  } finally {
    enviando = false
  }
}

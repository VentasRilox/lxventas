import { createClient } from '@supabase/supabase-js'

// La URL y la llave "publishable" son públicas por diseño: van dentro de la app
// y la seguridad real la pone el RLS de la base. La llave secreta (service_role)
// nunca se escribe aquí.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://khbquebnviarcluglrpa.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_t2a-bIu7RsPY-QNnd6ZgIA_yVdfLYhP'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Dominio interno para los usuarios sin correo: "milton" entra como
// milton@lxventas.com. Quien escribe un correo completo entra con ese correo.
export const DOMINIO_USUARIOS = 'lxventas.com'

export function usuarioACorreo(usuario) {
  const u = String(usuario ?? '').trim().toLowerCase()
  return u.includes('@') ? u : `${u}@${DOMINIO_USUARIOS}`
}

// Usuario sugerido a partir del nombre: inicial del primer nombre y primer
// apellido, sin tildes. "Omar Aguilar" → "oaguilar".
export function usuarioSugerido(nombre) {
  const palabras = String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (palabras.length < 2) return palabras[0] ?? ''
  // Con cuatro palabras o más se asume dos nombres y dos apellidos.
  const apellido = palabras.length >= 4 ? palabras[palabras.length - 2] : palabras[1]
  return palabras[0][0] + apellido
}

// Trae todas las filas de una consulta, de mil en mil (el tope por pedido).
export async function traerTodo(armarConsulta) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armarConsulta().range(desde, desde + 999)
    if (error) return { data: null, error }
    filas.push(...data)
    if (data.length < 1000) break
  }
  return { data: filas, error: null }
}

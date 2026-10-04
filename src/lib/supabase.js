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

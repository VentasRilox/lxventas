// ============================================================================
// Edge Function: crear-usuario
// ----------------------------------------------------------------------------
// Crea el acceso (auth) y el perfil de una persona del equipo, o le genera una
// contraseña nueva. El navegador no puede hacerlo: necesita la llave secreta,
// que solo existe aquí, en el servidor.
//
// Seguridad: se identifica a quien llama con su propio token.
//   * jefe activo: crea cualquier rol dentro de su empresa.
//   * supervisor activo: solo crea asesores, y solo en las zonas que supervisa.
// La contraseña la escribe quien crea el acceso; si no escribe ninguna, se
// genera aquí. En ambos casos se devuelve una sola vez.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DOMINIO = 'lxventas.com'
const ROLES = ['asesor', 'supervisor', 'jefe', 'gerencia']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Contraseña legible: sin caracteres que se confunden (0/O, 1/l/I).
function generarContrasena(largo = 8): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(largo)
  crypto.getRandomValues(bytes)
  let salida = ''
  for (let i = 0; i < largo; i++) salida += alfabeto[bytes[i] % alfabeto.length]
  return salida
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Falta la autorización' }, 401)

    const conPoderes = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // 1) Quién llama, según su token.
    const { data: quien, error: eQuien } = await conPoderes.auth.getUser(token)
    if (eQuien || !quien?.user) return json({ error: 'Sesión inválida. Vuelve a entrar.' }, 401)

    // 2) Su perfil: jefe o supervisor, y activo.
    const { data: jefe } = await conPoderes
      .from('perfiles')
      .select('id, empresa_id, rol, activo')
      .eq('usuario_id', quien.user.id)
      .maybeSingle()
    if (!jefe || !['jefe', 'supervisor'].includes(jefe.rol) || jefe.activo !== true) {
      return json({ error: 'Solo el jefe de ventas o un supervisor pueden administrar el equipo.' }, 403)
    }
    const esSupervisor = jefe.rol === 'supervisor'

    // Zonas que supervisa quien llama (solo importa si es supervisor).
    let misZonas: string[] = []
    if (esSupervisor) {
      const { data: zs } = await conPoderes.from('zonas').select('id').eq('empresa_id', jefe.empresa_id).eq('supervisor_id', jefe.id)
      misZonas = (zs ?? []).map((z) => z.id)
    }

    const body = await req.json().catch(() => ({}))
    // Contraseña escrita por quien llama, o una generada si la deja vacía.
    const pedida = String(body.contrasena ?? '').trim()
    if (pedida && pedida.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    if (pedida.length > 72) return json({ error: 'La contraseña es demasiado larga.' }, 400)
    const contrasena = pedida || generarContrasena()

    // ---- Nueva contraseña para alguien de la misma empresa ----
    if (body.accion === 'clave') {
      const { data: destino } = await conPoderes
        .from('perfiles')
        .select('usuario_id, empresa_id, rol, zona_id')
        .eq('id', String(body.perfil_id ?? ''))
        .maybeSingle()
      if (!destino || destino.empresa_id !== jefe.empresa_id) return json({ error: 'No se encontró a esa persona.' }, 404)
      if (esSupervisor && (destino.rol !== 'asesor' || !misZonas.includes(destino.zona_id))) {
        return json({ error: 'Solo puedes cambiar la contraseña de los asesores de tu equipo.' }, 403)
      }
      const { error: eClave } = await conPoderes.auth.admin.updateUserById(destino.usuario_id, { password: contrasena })
      if (eClave) return json({ error: 'No se pudo cambiar la contraseña: ' + eClave.message }, 400)
      return json({ ok: true, contrasena_temporal: contrasena })
    }

    // ---- Crear una persona ----
    const nombre = String(body.nombre ?? '').trim()
    const usuario = String(body.usuario ?? '').trim().toLowerCase()
    const rol = String(body.rol ?? '')
    const telefono = String(body.telefono ?? '').trim()
    const meta = Number.isFinite(Number(body.meta_mensual)) ? Math.max(0, Math.trunc(Number(body.meta_mensual))) : 0
    let zonaId: string | null = body.zona_id ?? null

    if (!nombre || !usuario) return json({ error: 'El nombre y el usuario son obligatorios.' }, 400)
    if (!/^[a-z0-9._@-]+$/.test(usuario)) return json({ error: 'El usuario solo puede llevar letras, números, punto y guion.' }, 400)
    if (!ROLES.includes(rol)) return json({ error: 'Rol no válido.' }, 400)

    if (esSupervisor && rol !== 'asesor') return json({ error: 'Un supervisor solo puede agregar asesores.' }, 403)
    if (esSupervisor && (!zonaId || !misZonas.includes(zonaId))) {
      return json({ error: 'Elige una zona de las que supervisas.' }, 400)
    }
    if (rol !== 'asesor') zonaId = null
    if (zonaId) {
      const { data: zona } = await conPoderes.from('zonas').select('empresa_id').eq('id', zonaId).maybeSingle()
      if (!zona || zona.empresa_id !== jefe.empresa_id) return json({ error: 'La zona no pertenece a tu empresa.' }, 400)
    }

    const correo = usuario.includes('@') ? usuario : `${usuario}@${DOMINIO}`

    const { data: creado, error: eCrear } = await conPoderes.auth.admin.createUser({
      email: correo,
      password: contrasena,
      email_confirm: true,
    })
    if (eCrear || !creado?.user) {
      const repetido = /already|registered|exists/i.test(eCrear?.message ?? '')
      return json({ error: repetido ? 'Ese usuario ya existe. Prueba con otro.' : 'No se pudo crear el acceso: ' + (eCrear?.message ?? 'desconocido') }, 400)
    }

    const { data: perfilNuevo, error: ePerfil } = await conPoderes
      .from('perfiles')
      .insert({
        usuario_id: creado.user.id,
        empresa_id: jefe.empresa_id,
        nombre,
        usuario: correo,
        rol,
        zona_id: zonaId,
        telefono: telefono || null,
        meta_mensual: meta,
        activo: true,
      })
      .select('id')
      .single()

    if (ePerfil) {
      // Sin perfil la cuenta no sirve: se borra para no dejarla huérfana.
      await conPoderes.auth.admin.deleteUser(creado.user.id)
      return json({ error: 'No se pudo crear el perfil: ' + ePerfil.message }, 400)
    }

    return json({ ok: true, perfil_id: perfilNuevo.id, contrasena_temporal: contrasena })
  } catch (e) {
    return json({ error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) }, 500)
  }
})

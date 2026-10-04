import { useCallback, useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase, DOMINIO_USUARIOS } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { mayus, titulo } from '../lib/reglas'
import Campo from '../components/Campo.jsx'
import PantallaEstado from '../components/PantallaEstado.jsx'

const ROLES = [['asesor', 'Asesor'], ['supervisor', 'Supervisor'], ['gerencia', 'Gerencia'], ['jefe', 'Jefe de ventas']]

async function llamarFuncion(cuerpo) {
  const { data, error } = await supabase.functions.invoke('crear-usuario', { body: cuerpo })
  if (error) {
    // El detalle real viene en el cuerpo de la respuesta de la función.
    let detalle = ''
    try {
      detalle = (await error.context.json()).error
    } catch {
      detalle = ''
    }
    return { error: detalle || traducirError(error) }
  }
  return data?.error ? { error: data.error } : { data }
}

export default function Equipo() {
  const { perfil, cfg, zonas, recargarEmpresa } = useSesion()
  const [perfiles, setPerfiles] = useState(null)
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', rol: 'asesor', zona_id: '', meta_mensual: '20', telefono: '' })
  const [zonaNueva, setZonaNueva] = useState({ nombre: '', meta_mensual: '60' })
  const [aviso, setAviso] = useState(null)
  const [clave, setClave] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const nz = cfg?.nombre_zona ?? 'Zona'

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('perfiles').select('*').order('rol').order('nombre')
    if (error) setAviso(['crit', traducirError(error)])
    setPerfiles(data ?? [])
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!perfiles) return <PantallaEstado mensaje="Cargando..." />

  async function crear(evento) {
    evento.preventDefault()
    setOcupado(true)
    setAviso(null)
    setClave(null)
    const r = await llamarFuncion({
      accion: 'crear',
      nombre: mayus(nuevo.nombre),
      usuario: nuevo.usuario.trim().toLowerCase(),
      rol: nuevo.rol,
      zona_id: nuevo.rol === 'asesor' ? nuevo.zona_id || null : null,
      meta_mensual: nuevo.rol === 'asesor' ? parseInt(nuevo.meta_mensual, 10) || 0 : 0,
      telefono: nuevo.telefono.trim(),
    })
    setOcupado(false)
    if (r.error) {
      setAviso(['crit', r.error])
      return
    }
    setClave({ usuario: nuevo.usuario.trim().toLowerCase(), contrasena: r.data.contrasena_temporal, nombre: mayus(nuevo.nombre) })
    setNuevo({ ...nuevo, nombre: '', usuario: '', telefono: '' })
    cargar()
  }

  async function nuevaClave(p) {
    setOcupado(true)
    setAviso(null)
    const r = await llamarFuncion({ accion: 'clave', perfil_id: p.id })
    setOcupado(false)
    if (r.error) setAviso(['crit', r.error])
    else setClave({ usuario: p.usuario, contrasena: r.data.contrasena_temporal, nombre: p.nombre })
  }

  async function editarPerfil(p, cambios) {
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', p.id)
    if (error) setAviso(['crit', traducirError(error)])
    cargar()
  }

  async function editarZona(z, cambios) {
    const { error } = await supabase.from('zonas').update(cambios).eq('id', z.id)
    if (error) setAviso(['crit', traducirError(error)])
    recargarEmpresa()
  }

  async function crearZona(evento) {
    evento.preventDefault()
    const { error } = await supabase.from('zonas').insert({ empresa_id: perfil.empresa_id, nombre: mayus(zonaNueva.nombre), meta_mensual: parseInt(zonaNueva.meta_mensual, 10) || 0 })
    if (error) setAviso(['crit', /duplicate/i.test(error.message) ? `Ya existe esa ${nz}.` : traducirError(error)])
    else setZonaNueva({ nombre: '', meta_mensual: '60' })
    recargarEmpresa()
  }

  const supervisores = perfiles.filter((p) => p.rol === 'supervisor' && p.activo)

  return (
    <main className="contenido">
      <h1>Equipo</h1>
      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}
      {clave && (
        <div className="aviso aviso--ok">
          <p>Acceso de {titulo(clave.nombre)}. Anótalo ahora: la contraseña no se vuelve a mostrar.</p>
          <p>Usuario: <b>{clave.usuario.replace('@' + DOMINIO_USUARIOS, '')}</b> · Contraseña: <b>{clave.contrasena}</b></p>
        </div>
      )}

      <section>
        <h2>{nz}</h2>
        <div className="tabla">
          <table>
            <thead><tr><th>{nz}</th><th>Meta del mes</th><th>Supervisor</th><th>Estado</th></tr></thead>
            <tbody>
              {zonas.map((z) => (
                <tr key={z.id}>
                  <td>{titulo(z.nombre)}</td>
                  <td>
                    <input aria-label={`Meta de ${z.nombre}`} inputMode="numeric" style={{ width: 90 }} defaultValue={z.meta_mensual} onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== z.meta_mensual) editarZona(z, { meta_mensual: n }) }} />
                  </td>
                  <td>
                    <select aria-label={`Supervisor de ${z.nombre}`} value={z.supervisor_id ?? ''} onChange={(e) => editarZona(z, { supervisor_id: e.target.value || null })}>
                      <option value="">Por asignar</option>
                      {supervisores.map((s) => <option key={s.id} value={s.id}>{titulo(s.nombre)}</option>)}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn btn--sec btn--chico" onClick={() => editarZona(z, { activa: !z.activa })}>
                      {z.activa ? 'Activa' : 'Cerrada'}
                    </button>
                  </td>
                </tr>
              ))}
              {zonas.length === 0 && <tr><td colSpan="4" className="muted">Aún no hay {nz}. Agrega la primera aquí abajo.</td></tr>}
            </tbody>
          </table>
        </div>
        <form className="grid2" onSubmit={crearZona}>
          <Campo etiqueta={`Nueva ${nz}`} nombre="nombre" f={zonaNueva} setF={setZonaNueva} prefijo="z" required />
          <Campo etiqueta="Meta del mes" nombre="meta_mensual" f={zonaNueva} setF={setZonaNueva} prefijo="z" inputMode="numeric" />
          <button type="submit" className="btn btn--sec full">Agregar {nz}</button>
        </form>
      </section>

      <section>
        <h2>Personas</h2>
        <div className="tabla">
          <table>
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>{nz}</th><th>Meta</th><th></th></tr></thead>
            <tbody>
              {perfiles.map((p) => (
                <tr key={p.id} style={p.activo ? undefined : { opacity: 0.55 }}>
                  <td>{titulo(p.nombre)}</td>
                  <td>{p.usuario.replace('@' + DOMINIO_USUARIOS, '')}</td>
                  <td>{ROLES.find((r) => r[0] === p.rol)?.[1]}</td>
                  <td>
                    {p.rol === 'asesor' ? (
                      <select aria-label={`${nz} de ${p.nombre}`} value={p.zona_id ?? ''} onChange={(e) => editarPerfil(p, { zona_id: e.target.value || null })}>
                        <option value="">Sin asignar</option>
                        {zonas.map((z) => <option key={z.id} value={z.id}>{titulo(z.nombre)}</option>)}
                      </select>
                    ) : p.rol === 'supervisor' ? (
                      zonas.filter((z) => z.supervisor_id === p.id).map((z) => titulo(z.nombre)).join(', ') || 'Asígnala arriba'
                    ) : (
                      'Todas'
                    )}
                  </td>
                  <td>
                    {p.rol === 'asesor' && (
                      <input aria-label={`Meta de ${p.nombre}`} inputMode="numeric" style={{ width: 80 }} defaultValue={p.meta_mensual} onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== p.meta_mensual) editarPerfil(p, { meta_mensual: n }) }} />
                    )}
                  </td>
                  <td>
                    {p.id !== perfil.id && (
                      <div className="acciones">
                        <button type="button" className="btn btn--sec btn--chico" disabled={ocupado} onClick={() => nuevaClave(p)}>Nueva contraseña</button>
                        <button type="button" className="btn btn--sec btn--chico" onClick={() => editarPerfil(p, { activo: !p.activo })}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Agregar una persona</h2>
        <form className="grid2" onSubmit={crear}>
          <Campo etiqueta="Nombre completo" nombre="nombre" f={nuevo} setF={setNuevo} full required autoComplete="off" />
          <Campo etiqueta="Usuario para entrar (sin espacios)" nombre="usuario" f={nuevo} setF={setNuevo} required autoCapitalize="none" autoComplete="off" pattern="[A-Za-z0-9._@\-]+" placeholder="ej.: milton" />
          <label htmlFor="n_rol">
            Rol
            <select id="n_rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          {nuevo.rol === 'asesor' && (
            <>
              <label htmlFor="n_zona">
                {nz}
                <select id="n_zona" value={nuevo.zona_id} onChange={(e) => setNuevo({ ...nuevo, zona_id: e.target.value })} required>
                  <option value="">Elige</option>
                  {zonas.filter((z) => z.activa).map((z) => <option key={z.id} value={z.id}>{titulo(z.nombre)}</option>)}
                </select>
              </label>
              <Campo etiqueta="Meta mensual de ventas" nombre="meta_mensual" f={nuevo} setF={setNuevo} inputMode="numeric" />
            </>
          )}
          <Campo etiqueta="Celular (opcional)" nombre="telefono" f={nuevo} setF={setNuevo} inputMode="numeric" />
          <button type="submit" className="btn full" disabled={ocupado}>{ocupado ? 'Creando...' : 'Crear acceso'}</button>
        </form>
        <p className="small muted">Al crear el acceso verás su contraseña una sola vez. El supervisor se asigna a su {nz} en la tabla de arriba.</p>
      </section>
    </main>
  )
}

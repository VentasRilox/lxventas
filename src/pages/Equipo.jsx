import { useCallback, useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase, DOMINIO_USUARIOS, usuarioSugerido } from '../lib/supabase'
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
    if (!detalle && error.context?.status === 404) {
      return { error: 'Falta instalar la función "crear-usuario" en Supabase. Sin ella no se pueden crear accesos.' }
    }
    return { error: detalle || traducirError(error) }
  }
  return data?.error ? { error: data.error } : { data }
}

export default function Equipo() {
  const { perfil, rol, cfg, zonas, recargarEmpresa } = useSesion()
  const esJefe = rol === 'jefe'
  const [motivos, setMotivos] = useState({})
  const [pidiendo, setPidiendo] = useState(null)
  const [perfiles, setPerfiles] = useState(null)
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', rol: 'asesor', zona_id: '', meta_mensual: '20', telefono: '', contrasena: '' })
  const [cambiando, setCambiando] = useState(null)
  const [claveNueva, setClaveNueva] = useState('')
  const [zonaNueva, setZonaNueva] = useState({ nombre: '', meta_mensual: '60' })
  const [aviso, setAviso] = useState(null)
  const [clave, setClave] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const nz = cfg?.nombre_zona ?? 'Zona'
  const dominio = cfg?.dominio_correo || DOMINIO_USUARIOS
  // Quien escribe solo el usuario recibe el dominio de la empresa.
  const correoDe = (usuario) => {
    const u = String(usuario ?? '').trim().toLowerCase()
    return !u || u.includes('@') ? u : `${u}@${dominio}`
  }

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
      usuario: correoDe(nuevo.usuario),
      rol: nuevo.rol,
      zona_id: nuevo.rol === 'asesor' ? nuevo.zona_id || null : null,
      meta_mensual: nuevo.rol === 'asesor' ? parseInt(nuevo.meta_mensual, 10) || 0 : 0,
      telefono: nuevo.telefono.trim(),
      contrasena: nuevo.contrasena.trim(),
    })
    setOcupado(false)
    if (r.error) {
      setAviso(['crit', r.error])
      return
    }
    setClave({ usuario: correoDe(nuevo.usuario), contrasena: r.data.contrasena_temporal, nombre: mayus(nuevo.nombre), distinta: Boolean(nuevo.contrasena.trim()) && r.data.contrasena_temporal !== nuevo.contrasena.trim() })
    setNuevo({ ...nuevo, nombre: '', usuario: '', telefono: '', contrasena: '' })
    cargar()
  }

  async function nuevaClave(p) {
    setOcupado(true)
    setAviso(null)
    const escrita = claveNueva.trim()
    const r = await llamarFuncion({ accion: 'clave', perfil_id: p.id, contrasena: escrita })
    setOcupado(false)
    if (r.error) {
      setAviso(['crit', r.error])
      return
    }
    setClave({ usuario: p.usuario, contrasena: r.data.contrasena_temporal, nombre: p.nombre, distinta: Boolean(escrita) && r.data.contrasena_temporal !== escrita })
    setCambiando(null)
    setClaveNueva('')
    window.scrollTo(0, 0)
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

  async function pedirBaja(p) {
    const { error } = await supabase.rpc('solicitar_baja', { p_perfil: p.id, p_motivo: motivos[p.id] ?? '' })
    if (error) setAviso(['crit', /solicitar_baja/.test(error.message) ? 'Falta ejecutar la migración 002 en Supabase.' : traducirError(error)])
    else setAviso(['ok', `Baja de ${titulo(p.nombre)} enviada al jefe de ventas para su autorización.`])
    setPidiendo(null)
    cargar()
  }

  async function cancelarBaja(p) {
    const { error } = await supabase.rpc('cancelar_baja', { p_perfil: p.id })
    if (error) setAviso(['crit', traducirError(error)])
    cargar()
  }

  async function aprobarBaja(p) {
    await editarPerfil(p, { activo: false, baja_solicitada_por: null, baja_motivo: null, baja_solicitada_en: null })
    setAviso(['ok', `${titulo(p.nombre)} quedó desactivado. Sus registros se conservan; puedes pasar su cartera a otro asesor desde Panel → Seguimiento.`])
  }

  const supervisores = perfiles.filter((p) => p.rol === 'supervisor' && p.activo)
  const misZonas = esJefe ? zonas.filter((z) => z.activa) : zonas.filter((z) => z.activa && z.supervisor_id === perfil.id)
  const bajas = perfiles.filter((p) => p.baja_solicitada_en && p.activo)
  const visibles = esJefe ? perfiles : perfiles.filter((p) => p.rol === 'asesor')
  const rolesNuevos = esJefe ? ROLES : ROLES.slice(0, 1)

  return (
    <main className="contenido">
      <h1>Equipo</h1>
      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}
      {clave && (
        <div className="aviso aviso--ok">
          <p>Acceso de {titulo(clave.nombre)}. Anótalo ahora: la contraseña no se vuelve a mostrar.</p>
          <p>Usuario: <b>{clave.usuario.replace('@' + DOMINIO_USUARIOS, '')}</b> · Contraseña: <b>{clave.contrasena}</b></p>
          {clave.distinta && <p>Ojo: no se usó la contraseña que escribiste, sino esta que generó el sistema. Falta actualizar la función "crear-usuario" en Supabase.</p>}
        </div>
      )}

      {!esJefe && (
        <p className="muted">
          {misZonas.length
            ? `Tu equipo: los asesores de ${nz} ${misZonas.map((z) => titulo(z.nombre)).join(' y ')}. Puedes agregar asesores y pedir su baja; la baja la autoriza el jefe de ventas.`
            : `Todavía no tienes ${nz} asignada. Pide al jefe de ventas que te asigne una para poder armar tu equipo.`}
        </p>
      )}

      {esJefe && bajas.length > 0 && (
        <section>
          <h2>Bajas por autorizar</h2>
          <ul className="lista">
            {bajas.map((p) => (
              <li key={p.id}>
                <span>
                  {titulo(p.nombre)}
                  <small>
                    Pedida por {titulo(perfiles.find((x) => x.id === p.baja_solicitada_por)?.nombre ?? 'un supervisor')}
                    {p.baja_motivo ? ` · ${p.baja_motivo}` : ''}
                  </small>
                </span>
                <span className="acciones">
                  <button type="button" className="btn btn--peligro btn--chico" onClick={() => aprobarBaja(p)}>Autorizar baja</button>
                  <button type="button" className="btn btn--sec btn--chico" onClick={() => cancelarBaja(p)}>Rechazar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {esJefe && (
      <section>
        <h2>{nz}</h2>
        <div className="tarjetas">
          {zonas.map((z) => (
            <div className="tarjeta" key={z.id} style={z.activa ? undefined : { opacity: 0.6 }}>
              <div className="fila">
                <h3>{titulo(z.nombre)}</h3>
                <button type="button" className="btn btn--sec btn--chico" onClick={() => editarZona(z, { activa: !z.activa })}>
                  {z.activa ? 'Activa' : 'Cerrada'}
                </button>
              </div>
              <div className="grid2">
                <label htmlFor={'zmeta_' + z.id}>
                  Meta del mes
                  <input id={'zmeta_' + z.id} inputMode="numeric" defaultValue={z.meta_mensual} onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== z.meta_mensual) editarZona(z, { meta_mensual: n }) }} />
                </label>
                <label className="full" htmlFor={'zabre_' + z.id}>
                  Abre el (su mes de venta cuenta desde este día)
                  <input id={'zabre_' + z.id} type="date" defaultValue={z.fecha_apertura ?? ''} onBlur={(e) => { const v = e.target.value || null; if (v !== (z.fecha_apertura ?? null)) editarZona(z, { fecha_apertura: v }) }} />
                </label>
                <label htmlFor={'zsup_' + z.id}>
                  Supervisor
                  <select id={'zsup_' + z.id} value={z.supervisor_id ?? ''} onChange={(e) => editarZona(z, { supervisor_id: e.target.value || null })}>
                    <option value="">Por asignar</option>
                    {supervisores.map((sp) => <option key={sp.id} value={sp.id}>{titulo(sp.nombre)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
        {zonas.length === 0 && <p className="muted">Aún no hay {nz}. Agrega la primera aquí abajo.</p>}
        <form className="grid2" onSubmit={crearZona}>
          <Campo etiqueta={`Nueva ${nz}`} nombre="nombre" f={zonaNueva} setF={setZonaNueva} prefijo="z" required />
          <Campo etiqueta="Meta del mes" nombre="meta_mensual" f={zonaNueva} setF={setZonaNueva} prefijo="z" inputMode="numeric" />
          <button type="submit" className="btn btn--sec full">Agregar {nz}</button>
        </form>
      </section>
      )}

      <section>
        <h2>{esJefe ? 'Personas' : 'Mis asesores'}</h2>
        <div className="tarjetas">
          {visibles.map((p) => (
            <div className="tarjeta" key={p.id} style={p.activo ? undefined : { opacity: 0.6 }}>
              <div className="fila">
                <h3>{titulo(p.nombre)}</h3>
                <span className={`pill ${p.activo ? (p.baja_solicitada_en ? 'warn' : 'neu') : 'crit'}`}>
                  {!p.activo ? 'Inactivo' : p.baja_solicitada_en ? 'Baja pedida' : ROLES.find((r) => r[0] === p.rol)?.[1]}
                </span>
              </div>
              <p className="small muted">
                Usuario: {p.usuario.replace('@' + DOMINIO_USUARIOS, '')}
                {p.rol === 'supervisor' && ` · ${nz}: ${zonas.filter((z) => z.supervisor_id === p.id).map((z) => titulo(z.nombre)).join(', ') || 'asígnala arriba'}`}
                {p.rol === 'asesor' && !esJefe && ` · ${nz} ${titulo(zonas.find((z) => z.id === p.zona_id)?.nombre ?? '')} · meta ${p.meta_mensual}`}
              </p>
              {esJefe && p.rol !== 'gerencia' && (
                <label htmlFor={'tel_' + p.id}>
                  Celular (para escribirle por WhatsApp)
                  <input id={'tel_' + p.id} inputMode="numeric" maxLength={9} defaultValue={p.telefono ?? ''} onBlur={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v !== (p.telefono ?? '')) editarPerfil(p, { telefono: v }) }} />
                </label>
              )}
              {p.rol === 'asesor' && esJefe && (
                <div className="grid2">
                  <label htmlFor={'zona_' + p.id}>
                    {nz}
                    <select id={'zona_' + p.id} value={p.zona_id ?? ''} onChange={(e) => editarPerfil(p, { zona_id: e.target.value || null })}>
                      <option value="">Sin asignar</option>
                      {zonas.map((z) => <option key={z.id} value={z.id}>{titulo(z.nombre)}</option>)}
                    </select>
                  </label>
                  <label htmlFor={'meta_' + p.id}>
                    Meta mensual
                    <input id={'meta_' + p.id} inputMode="numeric" defaultValue={p.meta_mensual} onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== p.meta_mensual) editarPerfil(p, { meta_mensual: n }) }} />
                  </label>
                </div>
              )}
              {p.id !== perfil.id && (
                <div className="acciones">
                  <button type="button" className="btn btn--sec btn--chico" disabled={ocupado} onClick={() => { setCambiando(cambiando === p.id ? null : p.id); setClaveNueva('') }}>Cambiar contraseña</button>
                  {esJefe && (
                    <button type="button" className="btn btn--sec btn--chico" onClick={() => editarPerfil(p, { activo: !p.activo })}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                  )}
                  {!esJefe && p.activo && !p.baja_solicitada_en && (
                    <button type="button" className="btn btn--sec btn--chico" onClick={() => setPidiendo(pidiendo === p.id ? null : p.id)}>Pedir baja</button>
                  )}
                  {!esJefe && p.baja_solicitada_en && (
                    <button type="button" className="btn btn--sec btn--chico" onClick={() => cancelarBaja(p)}>Cancelar la baja</button>
                  )}
                </div>
              )}
              {cambiando === p.id && (
                <div className="seccion">
                  <label htmlFor={'clave_' + p.id}>
                    Contraseña nueva (mínimo 6 caracteres)
                    <input id={'clave_' + p.id} value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} autoCapitalize="none" autoComplete="off" placeholder="Déjala vacía y el sistema crea una" />
                  </label>
                  <button type="button" className="btn btn--chico" disabled={ocupado || (claveNueva.trim().length > 0 && claveNueva.trim().length < 6)} onClick={() => nuevaClave(p)}>
                    {ocupado ? 'Guardando…' : 'Guardar contraseña'}
                  </button>
                </div>
              )}
              {pidiendo === p.id && (
                <div className="seccion">
                  <input aria-label="Motivo de la baja" placeholder="Motivo de la baja" value={motivos[p.id] ?? ''} onChange={(e) => setMotivos({ ...motivos, [p.id]: e.target.value })} />
                  <button type="button" className="btn btn--peligro btn--chico" onClick={() => pedirBaja(p)}>Enviar al jefe</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {visibles.length === 0 && <p className="muted">Aún no tienes asesores. Agrega el primero aquí abajo.</p>}
      </section>

      <section>
        <h2>{esJefe ? 'Agregar una persona' : 'Agregar un asesor'}</h2>
        <form className="grid2" onSubmit={crear}>
          <Campo etiqueta="Nombre completo" nombre="nombre" f={nuevo} setF={setNuevo} full required autoComplete="off" onBlur={() => setNuevo((antes) => (antes.usuario ? antes : { ...antes, usuario: usuarioSugerido(antes.nombre) }))} />
          <label htmlFor="c_usuario">
            Usuario para entrar (sin espacios)
            <input id="c_usuario" value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} required autoCapitalize="none" autoComplete="off" pattern="[A-Za-z0-9._@\-]+" placeholder="ej.: oaguilar" />
            {nuevo.usuario.trim() && <small className="muted">Entrará con: <b>{correoDe(nuevo.usuario)}</b></small>}
          </label>
          <label htmlFor="n_rol">
            Rol
            <select id="n_rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              {rolesNuevos.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          {nuevo.rol === 'asesor' && (
            <>
              <label htmlFor="n_zona">
                {nz}
                <select id="n_zona" value={nuevo.zona_id} onChange={(e) => setNuevo({ ...nuevo, zona_id: e.target.value })} required>
                  <option value="">Elige</option>
                  {misZonas.map((z) => <option key={z.id} value={z.id}>{titulo(z.nombre)}</option>)}
                </select>
              </label>
              <Campo etiqueta="Meta mensual de ventas" nombre="meta_mensual" f={nuevo} setF={setNuevo} inputMode="numeric" />
            </>
          )}
          <Campo etiqueta="Celular (opcional)" nombre="telefono" f={nuevo} setF={setNuevo} inputMode="numeric" />
          <Campo etiqueta="Contraseña (mínimo 6 caracteres)" nombre="contrasena" f={nuevo} setF={setNuevo} full autoCapitalize="none" autoComplete="off" minLength={6} placeholder="Déjala vacía y el sistema crea una" />
          <button type="submit" className="btn full" disabled={ocupado}>{ocupado ? 'Creando...' : 'Crear acceso'}</button>
        </form>
        <p className="small muted">
          Al crear el acceso verás su contraseña una sola vez: anótala.{esJefe ? ` El supervisor se asigna a su ${nz} en la tabla de arriba.` : ''}
        </p>
      </section>
    </main>
  )
}

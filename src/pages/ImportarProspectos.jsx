import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { fechaLocalHoy } from '../lib/fecha'
import { INTERESES, mayus, titulo } from '../lib/reglas'
import Chips from '../components/Chips.jsx'

// Lee una lista pegada, una persona por línea: "Nombre Apellido 987654321".
// El celular es el primer grupo de 9 dígitos que empieza en 9; el resto es el nombre.
export function leerLista(texto) {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const digitos = linea.replace(/[\s.\-]/g, '').match(/9\d{8}(?!\d)/)
      const celular = digitos ? digitos[0] : ''
      const nombre = mayus(
        linea
          .replace(/\d[\d\s.\-]{5,}\d/g, ' ')
          .replace(/^[\s\d.)\-°#]+/, '')
          .replace(/[,;|\t]+/g, ' ')
          .replace(/\s+/g, ' ')
      )
      return { nombre, celular }
    })
    .filter((x) => x.nombre)
}

export default function ImportarProspectos() {
  const { perfil, rol, cfg } = useSesion()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [lugar, setLugar] = useState('')
  const [interes, setInteres] = useState('medio')
  const [asesores, setAsesores] = useState([])
  const [asesorId, setAsesorId] = useState(rol === 'asesor' ? perfil.id : '')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const contacto = (cfg?.nombre_contacto ?? 'Contacto').toLowerCase()
  const filas = useMemo(() => leerLista(texto), [texto])
  const sinCelular = filas.filter((f) => !f.celular).length

  useEffect(() => {
    if (rol === 'asesor') return
    supabase
      .from('perfiles')
      .select('id, nombre, zona_id')
      .eq('rol', 'asesor')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setAsesores(data ?? []))
  }, [rol])

  async function guardar() {
    setGuardando(true)
    setAviso(null)
    const hoy = fechaLocalHoy()
    const destino = asesorId || perfil.id
    const zonaDestino = rol === 'asesor' ? perfil.zona_id : asesores.find((a) => a.id === destino)?.zona_id ?? null
    const registros = filas.map((f) => ({
      empresa_id: perfil.empresa_id,
      asesor_id: destino,
      zona_id: zonaDestino,
      idem_key: `${destino}|P|${f.celular || 'SIN|' + f.nombre}`,
      nombre: f.nombre,
      celular: f.celular || null,
      lugar: mayus(lugar),
      interes,
      estado: 'abierto',
      paso: 1,
      proximo_contacto: hoy,
    }))
    // Los que ya existían (mismo celular y asesor) no se tocan.
    const { data, error } = await supabase
      .from('prospectos')
      .upsert(registros, { onConflict: 'empresa_id,idem_key', ignoreDuplicates: true })
      .select('id')
    setGuardando(false)
    if (error) {
      setAviso(['crit', traducirError(error)])
      return
    }
    window.dispatchEvent(new Event('lxv-seguimiento'))
    const nuevos = data?.length ?? 0
    setAviso(['ok', `Listo: ${nuevos} ${contacto}s agregados${registros.length - nuevos ? `, ${registros.length - nuevos} ya estaban` : ''}.`])
    setTexto('')
    setTimeout(() => navigate('/seguimiento'), 1500)
  }

  return (
    <main className="contenido contenido--angosto">
      <Link to="/seguimiento" className="small">
        ← Volver a la lista
      </Link>
      <h1>Agregar varios {contacto}s de una vez</h1>
      <p className="muted">Pega la lista, una persona por línea, con su nombre y su celular. Después abres a cada uno para marcar si está frío, tibio o caliente, y su duda.</p>

      {rol !== 'asesor' && (
        <label htmlFor="i_asesor">
          ¿De qué asesor son?
          <select id="i_asesor" value={asesorId} onChange={(e) => setAsesorId(e.target.value)}>
            <option value="">Míos</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>{titulo(a.nombre)}</option>
            ))}
          </select>
        </label>
      )}

      <label htmlFor="i_lugar">
        {cfg?.nombre_lugar ?? 'Lugar'} (el mismo para toda la lista; puede quedar vacío)
        <input id="i_lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} autoComplete="off" />
      </label>

      <h2>Estado inicial del cliente</h2>
      <Chips opciones={INTERESES} valor={interes} alCambiar={(v) => setInteres(v || 'medio')} />

      <label htmlFor="i_lista">
        Lista
        <textarea id="i_lista" style={{ minHeight: 220 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Ana Ruiz Flores 987654321\nLuis Paz 912345678'} />
      </label>

      {filas.length > 0 && (
        <section>
          <h2>Así se van a guardar ({filas.length})</h2>
          <ul className="lista">
            {filas.map((f, i) => (
              <li key={i}>
                <span>{titulo(f.nombre)}</span>
                <span className={`pill ${f.celular ? 'neu' : 'warn'}`}>{f.celular || 'Sin celular'}</span>
              </li>
            ))}
          </ul>
          {sinCelular > 0 && <p className="aviso">{sinCelular} sin celular válido (9 dígitos y empieza en 9). Se guardan igual; corrige el número en la lista si lo tienes.</p>}
        </section>
      )}

      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}
      <button type="button" className="btn" disabled={guardando || filas.length === 0} onClick={guardar}>
        {guardando ? 'Guardando...' : `Guardar ${filas.length || ''} ${contacto}s`}
      </button>
    </main>
  )
}

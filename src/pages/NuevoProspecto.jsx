import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { traducirError } from '../lib/errores'
import { fechaLocalHoy } from '../lib/fecha'
import { INTERESES, MOTIVOS, mayus } from '../lib/reglas'
import Campo from '../components/Campo.jsx'
import Chips from '../components/Chips.jsx'

export default function NuevoProspecto() {
  const { perfil, cfg } = useSesion()
  const navigate = useNavigate()
  const [f, setF] = useState({ nombre: '', celular: '', lugar: '', condicion: '', interes: 'medio', motivo: '', comentario: '', referido_por: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const contacto = cfg?.nombre_contacto ?? 'Contacto'
  const celular = f.celular.replace(/\D/g, '')
  const falta = [!mayus(f.nombre) && 'nombre', celular.length !== 9 && 'celular de 9 dígitos'].filter(Boolean)

  async function guardar(evento) {
    evento.preventDefault()
    if (falta.length) return
    setGuardando(true)
    setError('')
    const hoy = fechaLocalHoy()
    // Se necesita señal: al guardar se abre la ficha con el primer mensaje listo.
    const { data, error: fallo } = await supabase
      .from('prospectos')
      .upsert(
        {
          empresa_id: perfil.empresa_id,
          asesor_id: perfil.id,
          zona_id: perfil.zona_id,
          idem_key: `${perfil.id}|P|${celular}`,
          nombre: mayus(f.nombre),
          celular,
          lugar: mayus(f.lugar),
          condicion: mayus(f.condicion),
          interes: f.interes,
          motivo: f.motivo || null,
          comentario: f.comentario.trim(),
          referido_por: mayus(f.referido_por),
          estado: 'abierto',
          paso: 1,
          proximo_contacto: hoy,
        },
        { onConflict: 'empresa_id,idem_key' }
      )
      .select('id')
      .single()
    setGuardando(false)
    if (fallo) {
      setError(traducirError(fallo))
      return
    }
    window.dispatchEvent(new Event('lxv-seguimiento'))
    navigate(`/seguimiento/${data.id}`, { replace: true })
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>Nuevo {contacto.toLowerCase()} en seguimiento</h1>
      <form className="seccion" onSubmit={guardar}>
        <div className="grid2">
          <Campo etiqueta="Nombre completo" nombre="nombre" f={f} setF={setF} full autoComplete="off" />
          <Campo etiqueta="Celular" nombre="celular" f={f} setF={setF} inputMode="numeric" maxLength={9} autoComplete="off" />
          <Campo etiqueta={cfg?.nombre_lugar ?? 'Lugar'} nombre="lugar" f={f} setF={setF} autoComplete="off" />
        </div>

        <h2>Condición laboral</h2>
        <Chips opciones={['Nombrado', 'Contratado']} valor={f.condicion} alCambiar={(v) => setF({ ...f, condicion: v })} />

        <h2>Interés</h2>
        <Chips opciones={INTERESES} valor={f.interes} alCambiar={(v) => setF({ ...f, interes: v || 'medio' })} />

        <h2>Su duda principal</h2>
        <Chips opciones={MOTIVOS} valor={f.motivo} alCambiar={(v) => setF({ ...f, motivo: v })} />

        <Campo etiqueta="Comentario" nombre="comentario" f={f} setF={setF} area placeholder="Lo que conversaron y lo que quedó pendiente" />
        <Campo etiqueta="¿Quién lo recomendó? (si es referido)" nombre="referido_por" f={f} setF={setF} />

        {falta.length > 0 && <p className="aviso">Falta: {falta.join(', ')}.</p>}
        {error && <p className="aviso aviso--crit">{error}</p>}

        <button type="submit" className="btn" disabled={guardando || falta.length > 0}>
          {guardando ? 'Guardando...' : 'Guardar y ver el primer mensaje'}
        </button>
      </form>
    </main>
  )
}

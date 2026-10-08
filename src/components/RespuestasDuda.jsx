import { useSesion } from '../lib/SesionProvider.jsx'
import { respuestasPara } from '../lib/respuestas'

// Tarjeta "Qué responder" según la duda elegida del docente.
export default function RespuestasDuda({ motivo }) {
  const { cfg } = useSesion()
  const lista = motivo ? respuestasPara(motivo, cfg) : []
  if (!lista.length) return null
  return (
    <div className="respuestas">
      <p className="etiqueta">Qué responder</p>
      <ul>
        {lista.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

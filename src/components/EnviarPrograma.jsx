import { useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { enlaceWhatsApp } from '../lib/mensajes'
import { textoPrograma } from '../lib/programa'
import { titulo } from '../lib/reglas'

// Botón de WhatsApp con la información completa del programa y la promoción.
export default function EnviarPrograma({ nombre, celular, lugar, secundario = false }) {
  const { perfil, cfg, plantillas } = useSesion()
  const [ver, setVer] = useState(false)
  if (!celular) return null
  const texto = textoPrograma(plantillas, {
    nombre: titulo(nombre).split(' ')[0],
    asesor: titulo(perfil.nombre),
    firma: cfg?.firma,
    producto: cfg?.producto,
    lugar: titulo(lugar ?? ''),
  })
  return (
    <div className="programa">
      <a className={`btn ${secundario ? 'btn--sec' : ''}`} href={enlaceWhatsApp(texto, celular)} target="_blank" rel="noopener noreferrer">
        Enviar información del programa
      </a>
      <button type="button" className="enlace small" onClick={() => setVer(!ver)}>
        {ver ? 'Ocultar mensaje' : 'Ver el mensaje'}
      </button>
      {ver && <pre className="mensaje">{texto}</pre>}
    </div>
  )
}

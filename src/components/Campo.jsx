import { ERROR, LARGO, soloDigitos } from '../lib/validar'

// Campo de texto con su etiqueta. Recibe el objeto del formulario y su setter
// para no repetir value/onChange en cada pantalla.
// Con solo="dni" o solo="celular" acepta únicamente números, corta en el largo
// exacto y avisa debajo mientras falten dígitos.
export default function Campo({ etiqueta, nombre, f, setF, full = false, area = false, prefijo = 'c', solo, ...resto }) {
  const largo = LARGO[solo]
  const props = {
    id: prefijo + '_' + nombre,
    value: f[nombre] ?? '',
    onChange: (e) => {
      const valor = largo ? soloDigitos(e.target.value, largo) : e.target.value
      setF((antes) => ({ ...antes, [nombre]: valor }))
    },
    ...(largo ? { inputMode: 'numeric', maxLength: largo, autoComplete: 'off', placeholder: `${largo} dígitos` } : {}),
    ...resto,
  }
  const error = largo ? ERROR[solo](props.value) : ''
  return (
    <label className={full ? 'full' : undefined} htmlFor={props.id}>
      {etiqueta}
      {area ? <textarea {...props} /> : <input {...props} aria-invalid={error ? true : undefined} />}
      {error && <small className="campo__error">{error}</small>}
    </label>
  )
}

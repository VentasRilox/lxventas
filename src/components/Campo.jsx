// Campo de texto con su etiqueta. Recibe el objeto del formulario y su setter
// para no repetir value/onChange en cada pantalla.
export default function Campo({ etiqueta, nombre, f, setF, full = false, area = false, prefijo = 'c', ...resto }) {
  const props = {
    id: prefijo + '_' + nombre,
    value: f[nombre] ?? '',
    onChange: (e) => setF((antes) => ({ ...antes, [nombre]: e.target.value })),
    ...resto,
  }
  return (
    <label className={full ? 'full' : undefined} htmlFor={props.id}>
      {etiqueta}
      {area ? <textarea {...props} /> : <input {...props} />}
    </label>
  )
}

// Fila de botones de opción. `opciones` es una lista de textos o de pares
// [valor, etiqueta]. Con `multiple`, `valor` es una lista.
export default function Chips({ opciones, valor, alCambiar, multiple = false, disabled = false }) {
  return (
    <div className="chips">
      {opciones.map((opcion) => {
        const [v, etiqueta] = Array.isArray(opcion) ? opcion : [opcion, opcion]
        const activo = multiple ? valor.includes(v) : String(valor ?? '').toUpperCase() === String(v).toUpperCase()
        return (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={activo}
            disabled={disabled}
            onClick={() => {
              if (multiple) alCambiar(activo ? valor.filter((x) => x !== v) : [...valor, v])
              else alCambiar(activo ? '' : v)
            }}
          >
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}

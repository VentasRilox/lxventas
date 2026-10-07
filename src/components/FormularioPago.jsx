import { useState } from 'react'
import { MEDIOS_CUOTA } from '../lib/reglas'
import Chips from './Chips.jsx'

// Datos del pago de la primera mensualidad: por dónde pagó y el número de
// operación. Lo usan el asesor (reporta) y el supervisor (confirma).
export default function FormularioPago({ textoBoton, ocupado, alGuardar, alCancelar }) {
  const [medio, setMedio] = useState('')
  const [operacion, setOperacion] = useState('')

  return (
    <div className="seccion pago">
      <Chips opciones={MEDIOS_CUOTA} valor={medio} alCambiar={setMedio} />
      <label>
        N.° de operación (el que sale en el voucher)
        <input value={operacion} onChange={(e) => setOperacion(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Opcional, pero ayuda a ubicar el pago" />
      </label>
      <div className="acciones">
        <button type="button" className="btn" disabled={ocupado || !medio} onClick={() => alGuardar({ medio: medio.toUpperCase(), operacion: operacion.trim() })}>
          {ocupado ? 'Guardando…' : textoBoton}
        </button>
        <button type="button" className="btn btn--sec" disabled={ocupado} onClick={alCancelar}>
          Cancelar
        </button>
      </div>
      {!medio && <p className="small muted">Elige por dónde pagó.</p>}
    </div>
  )
}

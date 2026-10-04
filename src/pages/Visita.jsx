import { useEffect, useState } from 'react'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { guardarRegistro } from '../lib/cola'
import { traducirError } from '../lib/errores'
import { fechaLocalHoy, horaLocalAhora } from '../lib/fecha'
import { mayus, visitaConIngreso } from '../lib/reglas'
import { enlaceWhatsApp, textoVisita } from '../lib/mensajes'
import Campo from '../components/Campo.jsx'
import Chips from '../components/Chips.jsx'

const RESULTADOS = ['Sí obtuvimos ingreso', 'No obtuvimos ingreso', 'Visita reprogramada']
const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

function vacio(numero) {
  return {
    resultado: '', lugar: '', numero: String(numero), celular: '', director: '', direccion: '', referencia: '',
    niveles: [], contactos: '', ventas_declaradas: '', movilidad: '', psi: '', observacion: '',
    fecha: fechaLocalHoy(), hora: horaLocalAhora(),
  }
}

export default function Visita() {
  const { perfil, zona, cfg } = useSesion()
  const [f, setF] = useState(() => vacio(1))
  const [lugares, setLugares] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const lugarNombre = cfg?.nombre_lugar ?? 'Lugar'
  const contactoNombre = cfg?.nombre_contacto ?? 'Contacto'
  const sin = f.resultado !== '' && !visitaConIngreso(f.resultado)
  const ctx = { asesor: perfil.nombre, zona: zona?.nombre ?? '', firma: cfg?.firma ?? '' }
  const datos = { ...f, niveles: f.niveles.join(', ') }
  const texto = textoVisita(datos, ctx)
  const falta = [!mayus(f.resultado) && 'resultado', !mayus(f.lugar) && lugarNombre.toLowerCase()].filter(Boolean)

  // Lugares ya visitados por este asesor: para completar sus datos al elegirlos
  // y para seguir la numeración de visitas del día.
  useEffect(() => {
    let activo = true
    supabase
      .from('visitas')
      .select('lugar, director, celular, direccion, referencia, niveles, fecha')
      .eq('asesor_id', perfil.id)
      .order('creado_en', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!activo || !data) return
        const mapa = {}
        for (const v of data) if (!mapa[v.lugar]) mapa[v.lugar] = v
        setLugares(mapa)
        const hoy = data.filter((v) => v.fecha === fechaLocalHoy()).length
        setF((antes) => (antes.lugar ? antes : { ...antes, numero: String(hoy + 1) }))
      })
    return () => {
      activo = false
    }
  }, [perfil.id])

  function alCambiarLugar(valor) {
    const conocido = lugares[mayus(valor)]
    setF((antes) =>
      conocido
        ? { ...antes, lugar: valor, director: conocido.director ?? '', celular: conocido.celular ?? '', direccion: conocido.direccion ?? '', referencia: conocido.referencia ?? '', niveles: conocido.niveles ? conocido.niveles.split(', ').map((n) => NIVELES.find((x) => x.toUpperCase() === n) ?? n) : [] }
        : { ...antes, lugar: valor }
    )
  }

  async function guardar() {
    if (falta.length) return false
    setGuardando(true)
    setAviso(null)
    const lugar = mayus(f.lugar)
    const fila = {
      empresa_id: perfil.empresa_id,
      asesor_id: perfil.id,
      zona_id: perfil.zona_id,
      idem_key: `${perfil.id}|V|${f.fecha}|${lugar}`,
      fecha: f.fecha,
      hora: f.hora,
      lugar,
      resultado: mayus(f.resultado),
      con_ingreso: !sin,
      numero: mayus(f.numero),
      niveles: sin ? '' : mayus(f.niveles.join(', ')),
      contactos: sin ? 0 : parseInt(f.contactos, 10) || 0,
      ventas_declaradas: sin ? 0 : parseInt(f.ventas_declaradas, 10) || 0,
      movilidad_centimos: Math.round((parseFloat(f.movilidad) || 0) * 100),
      director: mayus(f.director),
      celular: mayus(f.celular),
      direccion: mayus(f.direccion),
      referencia: mayus(f.referencia),
      psi: sin ? '' : mayus(f.psi),
      observacion: mayus(f.observacion),
    }
    const r = await guardarRegistro('visitas', fila)
    setGuardando(false)
    if (!r.ok) {
      setAviso(['crit', 'No se guardó: ' + traducirError(r.error)])
      return false
    }
    setLugares((antes) => ({ ...antes, [lugar]: fila }))
    setAviso(['ok', r.pendiente ? 'Sin señal: la visita quedó guardada en el celular y se subirá sola.' : 'Visita guardada.'])
    return true
  }

  async function enviar() {
    // La ventana se abre dentro del toque, antes de esperar a la base, para que
    // el navegador no la bloquee.
    const ventana = window.open(enlaceWhatsApp(texto), '_blank')
    const ok = await guardar()
    if (!ok && ventana) ventana.close()
  }

  function otra() {
    setF(vacio((parseInt(f.numero, 10) || 0) + 1))
    setAviso(null)
    window.scrollTo(0, 0)
  }

  return (
    <main className="contenido contenido--angosto">
      <h1>Reporte de visita</h1>

      <section>
        <h2>Resultado</h2>
        <Chips opciones={RESULTADOS} valor={f.resultado} alCambiar={(v) => setF({ ...f, resultado: v })} />
        <Campo etiqueta="Resultado de la visita" nombre="resultado" f={f} setF={setF} placeholder="Toca una opción o escribe el tuyo" />
      </section>

      <section>
        <h2>{lugarNombre}</h2>
        <div className="grid2">
          <label className="full" htmlFor="c_lugar">
            {lugarNombre} (los ya visitados se completan solos)
            <input id="c_lugar" list="lugares" autoComplete="off" value={f.lugar} onChange={(e) => alCambiarLugar(e.target.value)} />
            <datalist id="lugares">
              {Object.keys(lugares).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <Campo etiqueta="N° de visita" nombre="numero" f={f} setF={setF} inputMode="numeric" />
          <Campo etiqueta="Celular" nombre="celular" f={f} setF={setF} inputMode="tel" />
          <Campo etiqueta="Director(a)" nombre="director" f={f} setF={setF} full />
          <Campo etiqueta="Dirección" nombre="direccion" f={f} setF={setF} full />
          <Campo etiqueta="Referencia" nombre="referencia" f={f} setF={setF} full />
        </div>
        <Chips opciones={NIVELES} valor={f.niveles} multiple disabled={sin} alCambiar={(v) => setF({ ...f, niveles: NIVELES.filter((n) => v.includes(n)) })} />
      </section>

      <section>
        <h2>Números de la visita</h2>
        {sin && <p className="aviso">Sin ingreso: {contactoNombre.toLowerCase()}s, venta, niveles y PSI quedan en cero.</p>}
        <div className="grid2">
          <Campo etiqueta={`Total de ${contactoNombre.toLowerCase()}s`} nombre="contactos" f={f} setF={setF} inputMode="numeric" placeholder="0" disabled={sin} />
          <Campo etiqueta="Venta" nombre="ventas_declaradas" f={f} setF={setF} inputMode="numeric" placeholder="0" disabled={sin} />
          <Campo etiqueta="Movilidad (S/)" nombre="movilidad" f={f} setF={setF} inputMode="decimal" placeholder="0" />
          <Campo etiqueta="PSI" nombre="psi" f={f} setF={setF} disabled={sin} />
          <Campo etiqueta="Observación" nombre="observacion" f={f} setF={setF} full area />
          <Campo etiqueta="Fecha" nombre="fecha" f={f} setF={setF} type="date" />
          <Campo etiqueta="Hora" nombre="hora" f={f} setF={setF} type="time" />
        </div>
      </section>

      <section>
        <h2>Así saldrá el mensaje</h2>
        <pre className="mensaje">{texto}</pre>
      </section>

      {falta.length > 0 && <p className="aviso">Falta: {falta.join(', ')}.</p>}
      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}

      <div className="acciones">
        <button type="button" className="btn" disabled={guardando || falta.length > 0} onClick={enviar}>
          {guardando ? 'Guardando...' : 'Guardar y enviar por WhatsApp'}
        </button>
        <button type="button" className="btn btn--sec" disabled={guardando || falta.length > 0} onClick={guardar}>
          Solo guardar
        </button>
      </div>
      <button type="button" className="enlace" onClick={otra}>
        Empezar otra visita (limpia los datos y sube el N°)
      </button>
    </main>
  )
}

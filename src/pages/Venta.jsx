import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSesion } from '../lib/SesionProvider.jsx'
import { supabase } from '../lib/supabase'
import { guardarRegistro } from '../lib/cola'
import { traducirError } from '../lib/errores'
import { fechaLocalHoy, horaLocalAhora } from '../lib/fecha'
import { DOCUMENTOS, MEDIOS_CUOTA, cumpleCondiciones, faltaContrato, mayus, soles, titulo } from '../lib/reglas'
import { enlaceWhatsApp, llenarPlantilla, plantillaPara, textoVenta } from '../lib/mensajes'
import Campo from '../components/Campo.jsx'
import Chips from '../components/Chips.jsx'

const CLAVE_PROGRAMA = 'lxv_programa'

function recordado(clave) {
  try {
    return localStorage.getItem(clave) ?? ''
  } catch {
    return ''
  }
}

function vacio() {
  return {
    programa: recordado(CLAVE_PROGRAMA), estrategia: '', nombre: '', dni: '', celular: '', correo: '', lugar: '',
    desempeno: '', condicion: '', pago: '', suscripcion: '', beneficiario: '', observacion: '',
    cuota: '', cuota_medio: '', cuota_operacion: '',
    direccion: '', distrito: '', provincia: '', fecha_alta: '', sueldo: '', afp: '', cuspp: '', profesion: '', documentos: [],
    fecha: fechaLocalHoy(), hora: horaLocalAhora(),
  }
}

export default function Venta() {
  const { perfil, zona, cfg, plantillas } = useSesion()
  const [parametros, setParametros] = useSearchParams()
  const prospectoId = parametros.get('prospecto')
  const ventaId = parametros.get('id')
  const [original, setOriginal] = useState(null)
  const [f, setF] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [guardada, setGuardada] = useState(null)

  const lugarNombre = cfg?.nombre_lugar ?? 'Lugar'
  const ctx = { asesor: perfil.nombre, zona: zona?.nombre ?? '', firma: cfg?.firma ?? '' }
  const texto = textoVenta(f, ctx)
  const dni = f.dni.replace(/\D/g, '')
  const celular = f.celular.replace(/\D/g, '')
  const cumple = cumpleCondiciones({ condicion: f.condicion, pago: f.pago }, cfg)
  const pagoHoy = f.cuota === 'Ya pagó'
  const montoCuota = cfg?.primera_cuota_centimos ?? 13000
  const falta = [
    !mayus(f.programa) && 'programa',
    !mayus(f.nombre) && 'nombre',
    !ventaId && !f.cuota && 'indicar si ya pagó la primera mensualidad',
    !ventaId && pagoHoy && !f.cuota_medio && 'por dónde pagó',
    dni.length !== 8 && 'DNI de 8 dígitos',
    celular && celular.length !== 9 && 'celular de 9 dígitos',
  ].filter(Boolean)

  // Si viene de un prospecto, sus datos ya llegan llenos.
  useEffect(() => {
    if (!prospectoId) return
    let activo = true
    supabase
      .from('prospectos')
      .select('nombre, celular, lugar, condicion')
      .eq('id', prospectoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo || !data) return
        setF((antes) => ({ ...antes, nombre: data.nombre ?? '', celular: data.celular ?? '', lugar: data.lugar ?? '', condicion: titulo(data.condicion ?? '') }))
      })
    return () => {
      activo = false
    }
  }, [prospectoId])

  // Si se abre una venta ya registrada, se cargan sus datos para completarla.
  useEffect(() => {
    if (!ventaId) return
    let activo = true
    supabase
      .from('ventas')
      .select('*')
      .eq('id', ventaId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!activo) return
        if (error || !data) {
          setAviso(['crit', error ? traducirError(error) : 'No se encontró esa venta.'])
          return
        }
        setOriginal(data)
        const texto = (v) => titulo(v ?? '')
        setF({
          ...vacio(),
          programa: texto(data.programa), estrategia: texto(data.estrategia), nombre: texto(data.nombre), dni: data.dni ?? '', celular: data.celular ?? '',
          correo: data.correo ?? '', lugar: data.lugar ?? '', desempeno: texto(data.desempeno), condicion: texto(data.condicion), pago: texto(data.pago),
          suscripcion: texto(data.suscripcion), beneficiario: texto(data.beneficiario), observacion: texto(data.observacion),
          fecha: data.fecha, hora: data.hora ?? '',
          direccion: texto(data.direccion), distrito: texto(data.distrito), provincia: texto(data.provincia), fecha_alta: data.fecha_alta ?? '',
          sueldo: data.sueldo_centimos != null ? String(data.sueldo_centimos / 100) : '', afp: texto(data.afp), cuspp: data.cuspp ?? '', profesion: texto(data.profesion),
          documentos: DOCUMENTOS.filter(([campo]) => data[campo]).map((d) => d[1]),
        })
      })
    return () => {
      activo = false
    }
  }, [ventaId])

  const sueldo = parseFloat(String(f.sueldo).replace(',', '.'))
  const contrato = {
    direccion: mayus(f.direccion),
    distrito: mayus(f.distrito),
    provincia: mayus(f.provincia),
    fecha_alta: f.fecha_alta || null,
    sueldo_centimos: Number.isNaN(sueldo) ? null : Math.round(sueldo * 100),
    afp: mayus(f.afp),
    cuspp: mayus(f.cuspp),
    profesion: mayus(f.profesion),
    ...Object.fromEntries(DOCUMENTOS.map(([campo, etiqueta]) => [campo, f.documentos.includes(etiqueta)])),
  }
  const pendienteContrato = faltaContrato({ ...contrato, celular, correo: f.correo.trim(), desempeno: mayus(f.desempeno) })

  async function guardar() {
    if (falta.length) return false
    setGuardando(true)
    setAviso(null)
    const fila = {
      empresa_id: perfil.empresa_id,
      asesor_id: perfil.id,
      zona_id: perfil.zona_id,
      prospecto_id: prospectoId || null,
      idem_key: `${perfil.id}|S|${f.fecha}|${dni}`,
      fecha: f.fecha,
      hora: f.hora,
      ...contrato,
      nombre: mayus(f.nombre),
      dni,
      celular,
      correo: f.correo.trim().toLowerCase(),
      lugar: mayus(f.lugar),
      desempeno: mayus(f.desempeno),
      condicion: mayus(f.condicion),
      pago: mayus(f.pago),
      programa: mayus(f.programa),
      estrategia: mayus(f.estrategia),
      suscripcion: mayus(f.suscripcion),
      beneficiario: mayus(f.beneficiario),
      observacion: mayus(f.observacion),
      cuota_estado: pagoHoy ? 'reportada' : 'pendiente',
      cuota_medio: pagoHoy ? mayus(f.cuota_medio) : null,
      cuota_operacion: pagoHoy ? f.cuota_operacion.trim() : null,
      cuota_centimos: pagoHoy ? montoCuota : null,
      cuota_fecha: pagoHoy ? f.fecha : null,
    }
    if (ventaId) {
      // Completar una venta ya registrada: no se tocan su dueño, su fecha ni su pago.
      const cambios = { ...fila }
      for (const campo of ['empresa_id', 'asesor_id', 'zona_id', 'prospecto_id', 'idem_key', 'fecha', 'hora', 'cuota_estado', 'cuota_medio', 'cuota_operacion', 'cuota_centimos', 'cuota_fecha']) delete cambios[campo]
      const { error } = await supabase.from('ventas').update(cambios).eq('id', ventaId)
      setGuardando(false)
      setAviso(error ? ['crit', 'No se guardó: ' + traducirError(error)] : ['ok', 'Cambios guardados.'])
      return !error
    }
    const r = await guardarRegistro('ventas', fila)
    if (!r.ok) {
      setGuardando(false)
      setAviso(['crit', 'No se guardó: ' + traducirError(r.error)])
      return false
    }
    if (prospectoId && !r.pendiente) {
      await supabase.from('prospectos').update({ estado: 'ganado', proximo_contacto: null }).eq('id', prospectoId)
      window.dispatchEvent(new Event('lxv-seguimiento'))
    }
    try {
      localStorage.setItem(CLAVE_PROGRAMA, f.programa)
    } catch {
      // No pasa nada si no se puede recordar el programa.
    }
    setGuardando(false)
    setGuardada({ nombre: fila.nombre, celular })
    setAviso(['ok', r.pendiente ? 'Sin señal: la venta quedó guardada en el celular y se subirá sola.' : 'Venta guardada.'])
    return true
  }

  async function enviar() {
    const ventana = window.open(enlaceWhatsApp(texto), '_blank')
    const ok = await guardar()
    if (!ok && ventana) ventana.close()
  }

  function otra() {
    setF(vacio())
    setAviso(null)
    setGuardada(null)
    setOriginal(null)
    if (prospectoId || ventaId) setParametros({}, { replace: true })
    window.scrollTo(0, 0)
  }

  const referidos = plantillaPara(plantillas, 9, null)
  const textoReferidos = referidos && guardada
    ? llenarPlantilla(referidos.texto, { nombre: titulo(guardada.nombre), asesor: titulo(perfil.nombre), firma: cfg?.firma, producto: titulo(f.programa) || cfg?.producto })
    : ''

  return (
    <main className="contenido contenido--angosto">
      <h1>{ventaId ? 'Completar venta' : 'Cierre de venta'}</h1>
      {ventaId && original && <p className="muted">Venta del {original.fecha.split('-').reverse().join('/')}. Completa lo que falte para el contrato y guarda.</p>}

      <section>
        <h2>Programa</h2>
        <div className="grid2">
          <Campo etiqueta="Programa de estudio (se recuerda el último)" nombre="programa" f={f} setF={setF} full autoComplete="off" />
          <Campo etiqueta="Estrategia" nombre="estrategia" f={f} setF={setF} full />
        </div>
      </section>

      <section>
        <h2>{cfg?.nombre_contacto ?? 'Contacto'}</h2>
        <div className="grid2">
          <Campo etiqueta="Nombre completo" nombre="nombre" f={f} setF={setF} full autoComplete="off" />
          <Campo etiqueta="DNI" nombre="dni" f={f} setF={setF} inputMode="numeric" maxLength={8} autoComplete="off" />
          <Campo etiqueta="Celular" nombre="celular" f={f} setF={setF} inputMode="numeric" maxLength={9} autoComplete="off" />
          <Campo etiqueta="Correo electrónico" nombre="correo" f={f} setF={setF} full type="email" inputMode="email" autoComplete="off" />
          <Campo etiqueta={lugarNombre} nombre="lugar" f={f} setF={setF} full autoComplete="off" />
        </div>
        <Chips opciones={['Docente', 'Director', 'Auxiliar']} valor={f.desempeno} alCambiar={(v) => setF({ ...f, desempeno: v })} />
        <Campo etiqueta="Desempeño" nombre="desempeno" f={f} setF={setF} placeholder="Toca una opción o escribe otro" />
        <Chips opciones={['Nombrado', 'Contratado']} valor={f.condicion} alCambiar={(v) => setF({ ...f, condicion: v })} />
        <Campo etiqueta="Condición laboral" nombre="condicion" f={f} setF={setF} placeholder="Toca una opción o escribe otra" />
      </section>

      <section>
        <h2>Datos para el contrato</h2>
        <div className="grid2">
          <Campo etiqueta="Dirección" nombre="direccion" f={f} setF={setF} full autoComplete="off" />
          <Campo etiqueta="Distrito" nombre="distrito" f={f} setF={setF} autoComplete="off" />
          <Campo etiqueta="Provincia" nombre="provincia" f={f} setF={setF} autoComplete="off" />
          <Campo etiqueta="Fecha de alta" nombre="fecha_alta" f={f} setF={setF} type="date" />
          <Campo etiqueta="Sueldo (S/)" nombre="sueldo" f={f} setF={setF} inputMode="decimal" autoComplete="off" />
          <Campo etiqueta="AFP u ONP" nombre="afp" f={f} setF={setF} autoComplete="off" />
          <Campo etiqueta="Código CUSPP" nombre="cuspp" f={f} setF={setF} autoComplete="off" />
          <Campo etiqueta="Profesión u ocupación" nombre="profesion" f={f} setF={setF} full autoComplete="off" />
        </div>
        <h2>Documentos firmados y entregados</h2>
        <Chips opciones={DOCUMENTOS.map((d) => d[1])} valor={f.documentos} multiple alCambiar={(v) => setF({ ...f, documentos: v })} />
        {pendienteContrato.length > 0 && (
          <p className="aviso">Para el contrato todavía falta: {pendienteContrato.join(', ')}. Puedes guardar la venta ahora y completarlo después en "Mi avance".</p>
        )}
      </section>

      <section>
        <h2>Pago</h2>
        <Chips opciones={['Descuento por planilla', 'Pago directo']} valor={f.pago} alCambiar={(v) => setF({ ...f, pago: v })} />
        <div className="grid2">
          <Campo etiqueta="Modalidad de pago" nombre="pago" f={f} setF={setF} full placeholder="Toca una opción o escribe otra" />
          <Campo etiqueta="Suscripción" nombre="suscripcion" f={f} setF={setF} full />
          <Campo etiqueta="Beneficiario" nombre="beneficiario" f={f} setF={setF} full />
          <Campo etiqueta="Observación" nombre="observacion" f={f} setF={setF} full area />
          <Campo etiqueta="Fecha" nombre="fecha" f={f} setF={setF} type="date" />
          <Campo etiqueta="Hora" nombre="hora" f={f} setF={setF} type="time" />
        </div>
        {(f.condicion || f.pago) && !cumple && (
          <p className="aviso">Esta venta quedará "por revisar": solo cuenta para la meta la de nombrado con descuento por planilla.</p>
        )}
      </section>

      {!ventaId && (
      <section>
        <h2>Primera mensualidad · {soles(montoCuota)}</h2>
        <Chips opciones={['Ya pagó', 'Todavía no']} valor={f.cuota} alCambiar={(v) => setF({ ...f, cuota: v })} />
        {pagoHoy && (
          <>
            <Chips opciones={MEDIOS_CUOTA} valor={f.cuota_medio} alCambiar={(v) => setF({ ...f, cuota_medio: v })} />
            <Campo etiqueta="N.° de operación (el que sale en el voucher)" nombre="cuota_operacion" f={f} setF={setF} inputMode="numeric" autoComplete="off" placeholder="Opcional, pero ayuda a ubicar el pago" />
            <p className="small muted">Tu supervisor confirmará el pago. Desde ahí la venta cuenta para tu meta.</p>
          </>
        )}
        {f.cuota === 'Todavía no' && (
          <p className="aviso">La venta se guarda, pero no cuenta para tu meta hasta que se pague. Te aparecerá en "Hoy" para que le hagas seguimiento.</p>
        )}
      </section>
      )}

      {!ventaId && (
      <section>
        <h2>Así saldrá el mensaje</h2>
        <pre className="mensaje">{texto}</pre>
      </section>
      )}

      {falta.length > 0 && <p className="aviso">Falta: {falta.join(', ')}.</p>}
      {aviso && <p className={`aviso aviso--${aviso[0]}`}>{aviso[1]}</p>}

      {ventaId ? (
        <div className="acciones">
          <button type="button" className="btn" disabled={guardando || falta.length > 0 || !original} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      ) : (
      <div className="acciones">
        <button type="button" className="btn" disabled={guardando || falta.length > 0} onClick={enviar}>
          {guardando ? 'Guardando...' : 'Guardar y enviar por WhatsApp'}
        </button>
        <button type="button" className="btn btn--sec" disabled={guardando || falta.length > 0} onClick={guardar}>
          Solo guardar
        </button>
      </div>
      )}

      {guardada && textoReferidos && guardada.celular && (
        <section>
          <h2>Pide referidos ahora</h2>
          <pre className="mensaje">{textoReferidos}</pre>
          <a className="btn btn--sec" href={enlaceWhatsApp(textoReferidos, guardada.celular)} target="_blank" rel="noopener noreferrer">
            Escribirle a {titulo(guardada.nombre).split(' ')[0]}
          </a>
        </section>
      )}

      <button type="button" className="enlace" onClick={otra}>
        Empezar otra venta (limpia los datos)
      </button>
    </main>
  )
}

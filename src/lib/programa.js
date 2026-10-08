import { llenarPlantilla } from './mensajes'

// Mensaje con la información completa del programa. El jefe lo puede cambiar en
// Ajustes (se guarda como plantilla del paso 0). El orden busca que el descuento
// impacte: primero el precio regular, luego la promoción y cuánto ahorra.
export const PASO_PROGRAMA = 0

export const TEXTO_PROGRAMA = `Estimado(a) {nombre}, le saluda {asesor}, de {firma}. Como le comenté, le comparto la información 👇

🎓 *3 PROGRAMAS EN 1*, certificados por la prestigiosa *Universidad Nacional de Piura*:

1️⃣ *Especialización en Educación Inclusiva de Calidad*
12 meses · 1200 horas · 24 créditos

2️⃣ *Especialización Psicopedagógica Aplicada a la Educación*
6 meses · 600 horas · 24 créditos

3️⃣ *Curso de Capacitación en Inteligencias Múltiples e Inteligencias Emocionales*
1 mes · 120 horas

📚 *Modalidad modular:* avanza módulo por módulo, organizando su tiempo sin descuidar sus clases. Cada módulo es un logro concreto que suma a su formación.

💰 *Precio regular:*
Matrícula: S/ 260
12 mensualidades de S/ 260
*Total: S/ 3,380*

🔥 *CON LA PROMOCIÓN:*
Matrícula: ~S/ 260~ *¡GRATIS!*
12 mensualidades de ~S/ 260~ *S/ 130*
*Total: S/ 1,560*
✅ *Usted ahorra S/ 1,820* (más de la mitad)

💳 Paga cómodo con *descuento por planilla*.

📜 *Certificados* (al culminar cada programa):
• Curso de Inteligencias: S/ 100 (al 1.er mes)
• Especialización Psicopedagógica: S/ 300 (al 6.º mes)
• Especialización en Educación Inclusiva: S/ 300 (al 12.º mes)

¿Le separo su vacante con la promoción? Solo necesito su DNI. 🙌`

export function textoPrograma(plantillas, datos) {
  const propia = (plantillas ?? []).find((p) => p.paso === PASO_PROGRAMA && p.activa !== false)
  return llenarPlantilla(propia?.texto || TEXTO_PROGRAMA, datos)
}

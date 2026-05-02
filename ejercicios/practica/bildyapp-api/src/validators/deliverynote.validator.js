// src/validators/deliverynote.validator.js
import { z } from 'zod'

// Schema de un trabajador dentro de un albarán de horas.
// Reglas aplicadas:
//   - name no puede estar vacío (siempre tiene que haber nombre)
//   - hours debe ser un número positivo (no tiene sentido 0 o negativo)
const workerSchema = z.object({
  name: z.string().min(1, 'El nombre del trabajador es requerido'),
  hours: z.number().positive('Las horas deben ser un número positivo')
})

// Validación para POST /api/deliverynote — crear un albarán nuevo.
// Reglas aplicadas:
//   - format solo acepta 'material' o 'hours' (mismo enum que el modelo)
//   - description y workDate son obligatorios
//   - project y client son obligatorios (todo albarán pertenece a un proyecto y un cliente)
//   - workDate llega como string desde JSON; lo validamos con Date.parse()
//     porque el JSON no tiene tipo Date nativo
//   - Los campos de material y horas son todos opcionales en la validación,
//     porque depende del format. La lógica de "qué campos pedir según format"
//     se controla en el controlador, no aquí (mantenemos el validador simple).
export const createDeliveryNoteSchema = z.object({
  body: z.object({
    // Tipo de albarán: solo se aceptan estos dos valores
    format: z.enum(['material', 'hours'], {
      errorMap: () => ({ message: "El formato debe ser 'material' o 'hours'" })
    }),
    description: z.string().min(1, 'La descripción es requerida'),

    // Validamos que workDate sea una fecha parseable.
    // Ejemplos válidos: "2026-05-05", "2026-05-05T10:30:00Z"
    workDate: z.string().refine(
      val => !isNaN(Date.parse(val)),
      { message: 'La fecha de trabajo debe ser una fecha válida' }
    ),

    // Referencias a otros documentos: se reciben como strings (ObjectIds en hexadecimal)
    project: z.string().min(1, 'El proyecto es requerido'),
    client: z.string().min(1, 'El cliente es requerido'),

    // Campos específicos para format = 'material'
    material: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),

    // Campos específicos para format = 'hours'
    hours: z.number().positive('Las horas deben ser un número positivo').optional(),
    workers: z.array(workerSchema).optional()
  })
})

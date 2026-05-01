// src/validators/client.validator.js
import { z } from 'zod'

// Schema de la dirección postal.
// Todos los campos son opcionales: el cliente puede no tener dirección,
// o tenerla incompleta (por ejemplo, solo ciudad y provincia).
const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  postal: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional()
}).optional()

// Validación para POST /api/client — crear un cliente nuevo.
// Reglas aplicadas:
//   - name y cif son obligatorios (no puede crearse un cliente sin ellos)
//   - email se valida como email y se pasa a minúsculas para que coincida con el modelo
//   - trim() limpia espacios al principio y final, igual que el modelo Mongoose
export const createClientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre es requerido').trim(),
    cif: z.string().min(1, 'El CIF es requerido').trim(),
    email: z.string().email('Email inválido').toLowerCase().optional(),
    phone: z.string().trim().optional(),
    address: addressSchema
  })
})

// Validación para PUT /api/client/:id — actualizar un cliente existente.
// Aquí TODOS los campos son opcionales porque el usuario puede querer
// actualizar solo uno (por ejemplo, solo el teléfono).
export const updateClientSchema = z.object({
  body: z.object({
    name: z.string().min(1).trim().optional(),
    cif: z.string().min(1).trim().optional(),
    email: z.string().email('Email inválido').toLowerCase().optional(),
    phone: z.string().trim().optional(),
    address: addressSchema
  }).refine(
    // .refine() comprueba que el body no esté vacío.
    // Sin esta comprobación, un PUT con body {} pasaría la validación
    // y haría una "actualización" inútil que no cambia nada.
    // Forzamos a que se mande al menos un campo.
    data => Object.keys(data).length > 0,
    { message: 'Debes enviar al menos un campo para actualizar' }
  )
})

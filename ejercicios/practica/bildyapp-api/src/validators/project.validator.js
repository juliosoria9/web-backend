// src/validators/project.validator.js
import { z } from 'zod'

// Schema de la dirección postal del proyecto.
// Todos los campos son opcionales (igual que en el validador de cliente).
const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  postal: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional()
}).optional()

// Validación para POST /api/project — crear un proyecto nuevo.
// Reglas aplicadas:
//   - name y projectCode son obligatorios (datos básicos del proyecto)
//   - client es obligatorio: un proyecto siempre pertenece a un cliente.
//     Se recibe como string (el ObjectId de MongoDB en formato hexadecimal).
//   - email se normaliza a minúsculas para que coincida con el modelo
//   - active es opcional; si no se envía, el modelo aplica el default true
export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre es requerido').trim(),
    projectCode: z.string().min(1, 'El código de proyecto es requerido').trim(),
    client: z.string().min(1, 'El cliente es requerido'),
    email: z.string().email('Email inválido').toLowerCase().optional(),
    notes: z.string().optional(),
    address: addressSchema,
    active: z.boolean().optional()
  })
})

// Validación para PUT /api/project/:id — actualizar un proyecto existente.
// Todos los campos pasan a ser opcionales: el usuario puede actualizar
// solo lo que necesite (por ejemplo, solo cambiar el estado active).
export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).trim().optional(),
    projectCode: z.string().min(1).trim().optional(),
    client: z.string().min(1).optional(),
    email: z.string().email('Email inválido').toLowerCase().optional(),
    notes: z.string().optional(),
    address: addressSchema,
    active: z.boolean().optional()
  }).refine(
    // .refine() evita que el cliente mande un PUT con body vacío {}.
    // Si todos los campos son opcionales, sin esta comprobación
    // cualquier body vacío pasaría la validación.
    // Obligamos a que venga al menos un campo a actualizar.
    data => Object.keys(data).length > 0,
    { message: 'Debes enviar al menos un campo para actualizar' }
  )
})

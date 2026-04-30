// src/validators/user.validator.js
import { z } from 'zod'

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  postal: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional()
}).optional()

// POST /api/user/register
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
  })
})

// PUT /api/user/validation
export const validationSchema = z.object({
  body: z.object({
    code: z
      .string()
      .length(6, 'El código debe tener exactamente 6 dígitos')
      .regex(/^\d{6}$/, 'El código debe ser numérico')
  })
})

// POST /api/user/login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
    password: z.string().min(1, 'La contraseña es requerida')
  })
})

// PUT /api/user/register (onboarding personal)
export const personalDataSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre es requerido'),
    lastName: z.string().trim().min(1, 'Los apellidos son requeridos'),
    nif: z.string().trim().min(1, 'El NIF es requerido')
  })
})

// PATCH /api/user/company
export const companySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre es requerido').trim(),
    cif: z.string().min(1, 'El CIF es requerido').trim(),
    address: addressSchema,
    isFreelance: z.boolean().optional().default(false)
  })
})

// PUT /api/user/password (bonus)
export const passwordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
  }).refine(data => data.currentPassword !== data.newPassword, {
    message: 'La nueva contraseña debe ser diferente a la actual',
    path: ['newPassword']
  })
})

// POST /api/user/refresh
export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'El refreshToken es requerido')
  })
})

// POST /api/user/invite
export const inviteSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional()
  })
})

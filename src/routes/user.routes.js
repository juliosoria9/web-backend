// src/routes/user.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import {
  register,
  validateEmail,
  login
} from '../controllers/user.controller.js'
import {
  registerSchema,
  validationSchema,
  loginSchema
} from '../validators/user.validator.js'

const router = Router()

// Rutas públicas
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)

// Rutas protegidas
router.put('/validation', auth, validate(validationSchema), validateEmail)

export default router

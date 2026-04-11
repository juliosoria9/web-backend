// src/routes/user.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import {
  register,
  validateEmail,
  login,
  updatePersonalData,
  updateCompany
} from '../controllers/user.controller.js'
import {
  registerSchema,
  validationSchema,
  loginSchema,
  personalDataSchema,
  companySchema
} from '../validators/user.validator.js'

const router = Router()

// Rutas públicas
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)

// Rutas protegidas
router.put('/validation', auth, validate(validationSchema), validateEmail)
router.put('/register', auth, validate(personalDataSchema), updatePersonalData)
router.patch('/company', auth, validate(companySchema), updateCompany)

export default router

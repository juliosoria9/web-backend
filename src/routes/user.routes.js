// src/routes/user.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { checkRol } from '../middleware/role.middleware.js'
import {
  register,
  validateEmail,
  login,
  updatePersonalData,
  updateCompany,
  uploadLogo,
  getUser,
  deleteUser,
  refresh,
  logout,
  inviteUser,
  changePassword
} from '../controllers/user.controller.js'
import {
  registerSchema,
  validationSchema,
  loginSchema,
  personalDataSchema,
  companySchema,
  refreshSchema,
  inviteSchema,
  passwordSchema
} from '../validators/user.validator.js'

const router = Router()

// Rutas públicas
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.post('/refresh', validate(refreshSchema), refresh)

// Rutas protegidas
router.put('/validation', auth, validate(validationSchema), validateEmail)
router.put('/register', auth, validate(personalDataSchema), updatePersonalData)
router.put('/password', auth, validate(passwordSchema), changePassword)
router.patch('/company', auth, validate(companySchema), updateCompany)
router.patch('/logo', auth, upload.single('logo'), uploadLogo)
router.get('/', auth, getUser)
router.delete('/', auth, deleteUser)
router.post('/logout', auth, logout)
router.post('/invite', auth, checkRol(['admin']), validate(inviteSchema), inviteUser)

export default router

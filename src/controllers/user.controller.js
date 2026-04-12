// src/controllers/user.controller.js
import User from '../models/User.js'
import Company from '../models/Company.js'
import AppError from '../utils/AppError.js'
import { tokenSign, tokenSignRefresh } from '../utils/handleJwt.js'
import { encrypt, compare } from '../utils/handlePassword.js'
import notificationService from '../services/notification.service.js'

// POST /api/user/register
export const register = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const existingVerified = await User.findOne({ email, status: 'verified', deleted: false })
    if (existingVerified) {
      return next(AppError.conflict('El email ya está registrado'))
    }

    const hashedPassword = await encrypt(password)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    let user = await User.findOne({ email, deleted: false })

    if (user) {
      user.password = hashedPassword
      user.verificationCode = verificationCode
      user.verificationAttempts = 3
      await user.save()
    } else {
      user = await User.create({
        email,
        password: hashedPassword,
        verificationCode,
        verificationAttempts: 3
      })
    }

    const accessToken = tokenSign(user)
    const refreshToken = tokenSignRefresh(user)

    notificationService.emit('user:registered', { email: user.email })

    res.status(201).json({
      user: { email: user.email, status: user.status, role: user.role },
      accessToken,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
}

// PUT /api/user/validation
export const validateEmail = async (req, res, next) => {
  try {
    const { code } = req.body
    const user = req.user

    if (user.status === 'verified') {
      return next(AppError.badRequest('El email ya está verificado'))
    }

    if (user.verificationAttempts <= 0) {
      return next(AppError.tooMany('Has agotado los intentos de verificación'))
    }

    if (user.verificationCode !== code) {
      const remaining = user.verificationAttempts - 1
      await User.findByIdAndUpdate(user._id, { $inc: { verificationAttempts: -1 } })
      if (remaining <= 0) {
        return next(AppError.tooMany('Has agotado los intentos de verificación'))
      }
      return next(AppError.badRequest(`Código incorrecto. Intentos restantes: ${remaining}`))
    }

    await User.findByIdAndUpdate(user._id, {
      status: 'verified',
      verificationAttempts: 0,
      $unset: { verificationCode: 1 }
    })

    notificationService.emit('user:verified', { email: user.email })

    res.json({ message: 'Email verificado correctamente' })
  } catch (error) {
    next(error)
  }
}

// POST /api/user/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email, deleted: false }).select('+password')
    if (!user) {
      return next(AppError.unauthorized('Credenciales incorrectas'))
    }

    const isMatch = await compare(password, user.password)
    if (!isMatch) {
      return next(AppError.unauthorized('Credenciales incorrectas'))
    }

    const accessToken = tokenSign(user)
    const refreshToken = tokenSignRefresh(user)

    res.json({
      user: { email: user.email, status: user.status, role: user.role },
      accessToken,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
}

// PUT /api/user/register
export const updatePersonalData = async (req, res, next) => {
  try {
    const { name, lastName, nif } = req.body

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, lastName, nif },
      { new: true, runValidators: true }
    )

    res.json({ user })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/user/company
export const updateCompany = async (req, res, next) => {
  try {
    let { name, cif, address, isFreelance } = req.body
    const userId = req.user._id

    if (req.user.company) {
      return next(AppError.conflict('Ya tienes una compañía asociada'))
    }

    if (isFreelance) {
      const currentUser = await User.findById(userId)
      if (!currentUser.nif || !currentUser.name) {
        return next(AppError.badRequest('Completa tus datos personales antes de configurar empresa como autónomo'))
      }
      name = `${currentUser.name || ''} ${currentUser.lastName || ''}`.trim()
      cif = currentUser.nif
      address = currentUser.address
    }

    let company = await Company.findOne({ cif, deleted: false })

    if (!company) {
      company = await Company.create({
        owner: userId,
        name,
        cif,
        address,
        isFreelance: isFreelance || false
      })
      await User.findByIdAndUpdate(userId, { company: company._id })
    } else {
      await User.findByIdAndUpdate(userId, {
        company: company._id,
        role: 'guest'
      })
    }

    const user = await User.findById(userId).populate('company')
    res.json({ user })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/user/logo
export const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(AppError.badRequest('No se proporcionó ninguna imagen'))
    }

    const user = await User.findById(req.user._id)
    if (!user.company) {
      return next(AppError.badRequest('El usuario no tiene una compañía asociada'))
    }

    const logoUrl = `/uploads/${req.file.filename}`
    await Company.findByIdAndUpdate(user.company, { logo: logoUrl })

    res.json({ message: 'Logo actualizado correctamente', logo: logoUrl })
  } catch (error) {
    next(error)
  }
}

// GET /api/user
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('company')
    res.json({ user })
  } catch (error) {
    next(error)
  }
}

// DELETE /api/user
export const deleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { deleted: true })
    notificationService.emit('user:deleted', { email: req.user.email })
    res.json({ message: 'Usuario eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

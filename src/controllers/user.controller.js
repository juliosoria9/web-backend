// src/controllers/user.controller.js
import User from '../models/User.js'
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

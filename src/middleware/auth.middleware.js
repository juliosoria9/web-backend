// src/middleware/auth.middleware.js
import User from '../models/User.js'
import AppError from '../utils/AppError.js'
import { verifyToken } from '../utils/handleJwt.js'

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Token no proporcionado'))
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)

    if (!decoded?._id) {
      return next(AppError.unauthorized('Token inválido o expirado'))
    }

    const user = await User.findById(decoded._id)
    if (!user || user.deleted) {
      return next(AppError.unauthorized('Usuario no encontrado'))
    }

    req.user = user
    next()
  } catch {
    next(AppError.unauthorized('Error de autenticación'))
  }
}

// src/middleware/role.middleware.js
import AppError from '../utils/AppError.js'

export const checkRol = (roles) => (req, res, next) => {
  try {
    const { role } = req.user
    if (!roles.includes(role)) {
      return next(AppError.forbidden('No tienes permisos para esta acción'))
    }
    next()
  } catch {
    next(AppError.forbidden('Error de autorización'))
  }
}

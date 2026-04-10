// src/middleware/error-handler.js
import { ZodError } from 'zod'
import AppError from '../utils/AppError.js'

export const notFound = (req, res, next) => {
  next(AppError.notFound(`Ruta ${req.method} ${req.originalUrl} no encontrada`))
}

export const errorHandler = (err, req, res, next) => {
  // AppError (operational errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: true,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({ error: true, message: messages.join(', ') })
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    return res.status(400).json({ error: true, message: `Valor inválido para ${err.path}` })
  }

  // Duplicate key (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(409).json({ error: true, message: `El campo '${field}' ya está registrado` })
  }

  // Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: true,
      message: 'Error de validación',
      errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    })
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: true, message: 'Token inválido' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: true, message: 'Token expirado' })
  }

  // Generic
  console.error('Error no controlado:', err)
  res.status(500).json({
    error: true,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

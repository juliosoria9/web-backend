// src/middleware/error-handler.js
import { ZodError } from 'zod'
import AppError from '../utils/AppError.js'
import { notifySlackError } from '../services/notification.service.js'

export const notFound = (req, res, next) => {
  next(AppError.notFound(`Ruta ${req.method} ${req.originalUrl} no encontrada`))
}

// Handler global de errores — tiene que ir al final de app.js
export const errorHandler = async (err, req, res, next) => {
  // Errores controlados (AppError)
  if (err instanceof AppError) {
    const respuesta = { error: true, message: err.message }
    if (process.env.NODE_ENV === 'development') {
      respuesta.stack = err.stack
    }
    return res.status(err.statusCode).json(respuesta)
  }

  // Error de validación de Mongoose (campo requerido, tipo incorrecto...)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({ error: true, message: messages.join(', ') })
  }

  // CastError: ID con formato incorrecto
  if (err.name === 'CastError') {
    return res.status(400).json({ error: true, message: `Valor inválido para ${err.path}` })
  }

  // Clave duplicada en MongoDB (índice único)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(409).json({ error: true, message: `El campo '${field}' ya está registrado` })
  }

  // Error de validación de Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: true,
      message: 'Error de validación',
      errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    })
  }

  // Token JWT inválido o expirado
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: true, message: 'Token inválido' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: true, message: 'Token expirado' })
  }

  // Error 500 genérico
  console.error('Error no controlado:', err)
  await notifySlackError(req, err)

  const respuesta500 = { error: true, message: 'Error interno del servidor' }
  if (process.env.NODE_ENV === 'development') {
    respuesta500.message = err.message
    respuesta500.stack = err.stack
  }
  res.status(500).json(respuesta500)
}

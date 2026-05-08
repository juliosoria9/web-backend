// src/utils/AppError.js
class AppError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest (message = 'Solicitud incorrecta') {
    return new AppError(message, 400)
  }

  static unauthorized (message = 'No autorizado') {
    return new AppError(message, 401)
  }

  static forbidden (message = 'Acceso denegado') {
    return new AppError(message, 403)
  }

  static notFound (message = 'No encontrado') {
    return new AppError(message, 404)
  }

  static conflict (message = 'Conflicto') {
    return new AppError(message, 409)
  }

  static tooMany (message = 'Demasiadas solicitudes') {
    return new AppError(message, 429)
  }
}

export default AppError

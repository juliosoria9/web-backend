// src/middleware/socket-auth.js
// Middleware de autenticación para Socket.IO.
// El cliente debe enviar el JWT en socket.handshake.auth.token al conectarse.

import { verifyToken } from '../utils/handleJwt.js'
import User from '../models/User.js'

// Verifica el JWT y carga el usuario completo antes de permitir la conexión
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token

    // Si no hay token, rechazamos la conexión inmediatamente
    if (!token) {
      return next(new Error('Token no proporcionado'))
    }

    // Verificamos la firma del JWT usando la misma función que el resto de la app
    const decoded = verifyToken(token)
    if (!decoded?._id) {
      return next(new Error('Token inválido'))
    }

    // Cargamos el usuario completo para tener acceso a su compañía
    // populate('company') trae el documento de Company embebido
    const user = await User.findById(decoded._id).populate('company')
    if (!user || user.deleted) {
      return next(new Error('Usuario no encontrado'))
    }

    // Guardamos el usuario en el socket para usarlo en los eventos
    socket.user = user
    next()
  } catch (error) {
    next(new Error('Error de autenticación en socket'))
  }
}

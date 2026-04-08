// src/config/index.js
import mongoose from 'mongoose'

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUri: process.env.DB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
}

if (!config.dbUri) {
  console.error('DB_URI no está definida en las variables de entorno')
  process.exit(1)
}

if (!config.jwt.secret) {
  console.error('JWT_SECRET no está definida en las variables de entorno')
  process.exit(1)
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB desconectado')
})

export const dbConnect = async () => {
  try {
    await mongoose.connect(config.dbUri)
    console.log('MongoDB conectado')
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message)
    process.exit(1)
  }
}

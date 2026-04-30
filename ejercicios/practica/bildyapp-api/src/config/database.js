// src/config/database.js
// Gestiona la conexión a MongoDB usando Mongoose.
// Se separó de config/index.js para mantener cada responsabilidad en su propio archivo.
import mongoose from 'mongoose'
import { config } from './index.js'

// Avisa por consola cuando Mongoose pierde la conexión con MongoDB
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB desconectado')
})

// Conecta la aplicación a MongoDB usando la URI del .env.
// Si la conexión falla, detiene el proceso (no tiene sentido arrancar sin BD).
export const dbConnect = async () => {
  try {
    await mongoose.connect(config.dbUri)
    console.log('MongoDB conectado')
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message)
    process.exit(1)
  }
}

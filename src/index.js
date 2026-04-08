// src/index.js
import app from './app.js'
import { dbConnect, config } from './config/index.js'

try {
  await dbConnect()
  app.listen(config.port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${config.port}`)
    console.log(`Entorno: ${config.nodeEnv}`)
  })
} catch (error) {
  console.error('Error al iniciar el servidor:', error)
  process.exit(1)
}

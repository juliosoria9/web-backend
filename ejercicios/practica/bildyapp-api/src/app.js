// src/app.js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Rutas de la API
import userRoutes from './routes/user.routes.js'
import clientRoutes from './routes/client.routes.js'
import projectRoutes from './routes/project.routes.js'
import deliveryNoteRoutes from './routes/deliverynote.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'

// Documentación Swagger
import { swaggerUi, swaggerSpec } from './config/swagger.js'

// Manejo de errores
import { notFound, errorHandler } from './middleware/error-handler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

// Seguridad (T6)
app.use(helmet())
// El rate limiter se desactiva en entorno de test para evitar errores 429
// que se producirían al ejecutar muchos tests en rápida sucesión
if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Demasiadas peticiones, intenta más tarde' }
  }))
}

// Parseo y sanitización
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body)
  next()
})

// Archivos estáticos
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')))

// Health check mejorado: incluye el estado de la conexión a MongoDB
app.get('/health', (req, res) => {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbState = mongoose.connection.readyState
  res.json({
    status: 'ok',
    db: dbState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Documentación interactiva de la API (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Rutas API
app.use('/api/user', userRoutes)
app.use('/api/client', clientRoutes)
app.use('/api/project', projectRoutes)
app.use('/api/deliverynote', deliveryNoteRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Manejo de errores (deben ir al final)
app.use(notFound)
app.use(errorHandler)

export default app

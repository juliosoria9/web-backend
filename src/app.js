// src/app.js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import userRoutes from './routes/user.routes.js'
import { notFound, errorHandler } from './middleware/error-handler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

// Seguridad (T6)
app.use(helmet())
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Demasiadas peticiones, intenta más tarde' }
}))

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
})

// Rutas API
app.use('/api/user', userRoutes)

// Manejo de errores (deben ir al final)
app.use(notFound)
app.use(errorHandler)

export default app

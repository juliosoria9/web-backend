// src/index.js
// Punto de entrada de la aplicación.
// Crea el servidor HTTP, inicializa Socket.IO y arranca todo.

import http from 'http'
import { Server } from 'socket.io'
import app from './app.js'
import { config } from './config/index.js'
import { dbConnect } from './config/database.js'
import { socketAuth } from './middleware/socket-auth.js'

// Creamos el servidor HTTP a partir de la app Express
// Esto nos permite compartir el mismo puerto entre HTTP y WebSockets
const server = http.createServer(app)

// Iniciamos Socket.IO sobre el servidor HTTP
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Guardamos io en app.locals para que los controladores puedan emitir eventos
// Uso desde un controlador: req.app.locals.io.to('company:xxx').emit('evento', datos)
app.locals.io = io

// Middleware de autenticación: todas las conexiones deben tener JWT válido
io.use(socketAuth)

// Gestión de conexiones de clientes
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Cliente conectado: ${socket.id}`)

  // Unimos el socket a la room de su compañía para mensajes dirigidos
  // Solo recibirá eventos emitidos a su propia compañía
  if (socket.user?.company?._id) {
    const roomName = `company:${socket.user.company._id}`
    socket.join(roomName)
    console.log(`[Socket.IO] ${socket.user.email} se unió a la room ${roomName}`)
  }

  // Unimos el socket a su sala personal para enviar confirmaciones dirigidas
  // El controlador puede emitir a `user:<id>` para hablarle solo al firmante/actor
  if (socket.user?._id) {
    const userRoom = `user:${socket.user._id}`
    socket.join(userRoom)
    console.log(`[Socket.IO] ${socket.user.email} se unió a la room ${userRoom}`)
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`)
  })
})

// Cierra el servidor de forma ordenada sin perder peticiones en curso
const shutdown = async (signal) => {
  console.log(`\n[Server] Señal ${signal} recibida. Cerrando servidor...`)

  // Dejamos de aceptar nuevas conexiones HTTP
  server.close(async () => {
    try {
      // Cerramos Socket.IO antes de la base de datos
      io.close()

      // Cerramos la conexión a MongoDB
      const { default: mongoose } = await import('mongoose')
      await mongoose.connection.close()

      console.log('[Server] Servidor cerrado correctamente')
      process.exit(0)
    } catch (error) {
      console.error('[Server] Error al cerrar:', error)
      process.exit(1)
    }
  })
}

// Capturamos señales del sistema operativo para el graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM')) // Docker / Kubernetes stop
process.on('SIGINT', () => shutdown('SIGINT'))   // Ctrl+C en local

// Arrancamos: primero conectamos a MongoDB, luego escuchamos peticiones
try {
  await dbConnect()
  server.listen(config.port, () => {
    console.log(`[Server] Servidor en http://localhost:${config.port}`)
    console.log(`[Server] Entorno: ${config.nodeEnv}`)
    console.log(`[Server] Docs: http://localhost:${config.port}/api-docs`)
  })
} catch (error) {
  console.error('[Server] Error al arrancar:', error)
  process.exit(1)
}

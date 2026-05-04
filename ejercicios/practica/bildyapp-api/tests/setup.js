import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer

// Arranca el servidor MongoDB en memoria y conecta Mongoose
// Llama esto en el beforeAll() de cada test file
export const connectTestDB = async () => {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)
}

// Desconecta Mongoose y para el servidor en memoria
// Llama esto en el afterAll() de cada test file
export const disconnectTestDB = async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
}

// Limpia todas las colecciones entre tests para que no haya datos residuales
// Llama esto en el afterEach() de cada test file
export const clearTestDB = async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
}

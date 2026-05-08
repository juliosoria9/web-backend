// tests/socket.test.js
// Test integrador de Socket.IO con dos clientes en la misma compañía.
// Verifica que:
//   - El broadcast `deliverynote:signed` llega a la sala `company:<id>` (a ambos).
//   - La confirmación `deliverynote:signed:ack` llega sólo al firmante (sala `user:<id>`).
//
// Mockeamos storage.service (Supabase) para no necesitar credenciales reales y
// poder ejecutar la firma punto a punto desde HTTP.

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as ioClient } from 'socket.io-client'
import request from 'supertest'
import { connectTestDB, disconnectTestDB, clearTestDB } from './setup.js'

// ── Mock de Supabase Storage ─────────────────────────────────────────────────
// Devolvemos URLs ficticias para que el flujo de firma se complete sin red.
jest.unstable_mockModule('../src/services/storage.service.js', () => ({
  uploadImage: jest.fn(async () => 'https://fake.test/signature.webp'),
  uploadPdf: jest.fn(async () => 'https://fake.test/albaran.pdf')
}))

// ── Imports después del mock ─────────────────────────────────────────────────
// Con ES Modules y `unstable_mockModule` los imports tienen que ser dinámicos
// y posteriores al mock para que Jest sirva la versión mockeada.
const { default: app } = await import('../src/app.js')
const { socketAuth } = await import('../src/middleware/socket-auth.js')
const { tokenSign } = await import('../src/utils/handleJwt.js')
const { default: User } = await import('../src/models/User.js')
const { default: Company } = await import('../src/models/Company.js')
const { default: Client } = await import('../src/models/Client.js')
const { default: Project } = await import('../src/models/Project.js')
const { default: DeliveryNote } = await import('../src/models/DeliveryNote.js')

// ── Arranque del servidor HTTP+Socket.IO en un puerto libre ──────────────────
let httpServer
let io
let port

beforeAll(async () => {
  await connectTestDB()
  httpServer = http.createServer(app)
  io = new SocketIOServer(httpServer, { cors: { origin: '*' } })
  app.locals.io = io
  io.use(socketAuth)
  io.on('connection', (socket) => {
    if (socket.user?.company?._id) {
      socket.join(`company:${socket.user.company._id}`)
    }
    if (socket.user?._id) {
      socket.join(`user:${socket.user._id}`)
    }
  })

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      port = httpServer.address().port
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve))
  await new Promise((resolve) => httpServer.close(resolve))
  await disconnectTestDB()
})

beforeEach(async () => {
  await clearTestDB()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

// Conecta un socket-client autenticado con `token`. Devuelve el socket cuando
// el evento `connect` se ha disparado para evitar carreras con la suscripción.
const connectClient = (token) => new Promise((resolve, reject) => {
  const socket = ioClient(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  })
  socket.on('connect', () => resolve(socket))
  socket.on('connect_error', reject)
})

// Crea dos usuarios en la misma compañía. El primero es admin (dueño).
const setupTwoUsersSameCompany = async () => {
  // El owner se conoce sólo después de crear el primer usuario, así que
  // creamos los usuarios sin compañía y luego los asociamos.
  const userA = await User.create({
    email: 'a@test.com',
    password: 'irrelevant_hash_xx_long_enough',
    role: 'admin',
    status: 'verified'
  })
  const userB = await User.create({
    email: 'b@test.com',
    password: 'irrelevant_hash_xx_long_enough',
    role: 'guest',
    status: 'verified'
  })
  const company = await Company.create({
    owner: userA._id,
    name: 'ACME',
    cif: 'B11111111'
  })
  await User.findByIdAndUpdate(userA._id, { company: company._id })
  await User.findByIdAndUpdate(userB._id, { company: company._id })
  // Recargamos para tener la compañía asociada (necesaria para el JWT/middleware)
  const userAFull = await User.findById(userA._id).populate('company')
  const userBFull = await User.findById(userB._id).populate('company')
  return {
    company,
    userA: userAFull,
    userB: userBFull,
    tokenA: tokenSign(userAFull),
    tokenB: tokenSign(userBFull)
  }
}

describe('Socket.IO — broadcast vs ack al firmar un albarán', () => {
  it('emite signed a toda la compañía y :ack sólo al firmante', async () => {
    const { company, userA, tokenA, tokenB } = await setupTwoUsersSameCompany()

    // Cliente y proyecto requeridos por el endpoint POST /api/deliverynote
    const client = await Client.create({
      name: 'Cliente X',
      cif: 'A22222222',
      company: company._id,
      user: userA._id
    })
    const project = await Project.create({
      name: 'Proyecto X',
      projectCode: 'PRJ-X',
      client: client._id,
      company: company._id,
      user: userA._id
    })
    const note = await DeliveryNote.create({
      user: userA._id,
      company: company._id,
      client: client._id,
      project: project._id,
      format: 'hours',
      description: 'Horas de prueba',
      workDate: new Date('2026-01-15'),
      hours: 4
    })

    // Conectamos los dos clientes y registramos las recepciones de eventos
    const socketA = await connectClient(tokenA)
    const socketB = await connectClient(tokenB)

    const aSignedEvents = []
    const aAckEvents = []
    const bSignedEvents = []
    let bReceivedAck = false

    socketA.on('deliverynote:signed', (payload) => aSignedEvents.push(payload))
    socketA.on('deliverynote:signed:ack', (payload) => aAckEvents.push(payload))
    socketB.on('deliverynote:signed', (payload) => bSignedEvents.push(payload))
    socketB.on('deliverynote:signed:ack', () => { bReceivedAck = true })

    // Disparamos el firmado vía HTTP. Adjuntamos un buffer mínimo: como
    // mockeamos uploadImage/uploadPdf no se procesa con Sharp/Supabase.
    const res = await request(httpServer)
      .patch(`/api/deliverynote/${note._id}/sign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('signature', Buffer.from('fake-png-bytes'), 'firma.png')

    expect(res.status).toBe(200)

    // Damos margen para que los eventos viajen por el bucle de Socket.IO
    await new Promise((r) => setTimeout(r, 200))

    // Ambos clientes reciben el broadcast company-wide
    expect(aSignedEvents).toHaveLength(1)
    expect(bSignedEvents).toHaveLength(1)
    expect(String(aSignedEvents[0]._id)).toBe(String(note._id))

    // Sólo el firmante (A) recibe el :ack en su sala personal
    expect(aAckEvents).toHaveLength(1)
    expect(String(aAckEvents[0].deliveryNoteId)).toBe(String(note._id))
    expect(aAckEvents[0]).toHaveProperty('signedAt')
    expect(aAckEvents[0]).toHaveProperty('signatureUrl')

    // B nunca debe recibir :ack
    expect(bReceivedAck).toBe(false)

    socketA.disconnect()
    socketB.disconnect()
  })
})

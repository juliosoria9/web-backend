// tests/deliverynote.test.js
// Tests de integración para los endpoints de /api/deliverynote
// Cada test crea desde cero: usuario + compañía + cliente + proyecto
// El endpoint de firma (PATCH /:id/sign) se omite porque requiere Supabase real

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import request from 'supertest'
import app from '../src/app.js'
import { connectTestDB, disconnectTestDB, clearTestDB } from './setup.js'

beforeAll(async () => {
  await connectTestDB()
})

afterAll(async () => {
  await disconnectTestDB()
})

afterEach(async () => {
  await clearTestDB()
})

// ── Helpers reutilizables ────────────────────────────────────────────────────

// Registra un usuario y devuelve su accessToken
const registerUser = async (email = 'admin@test.com', password = 'password123') => {
  const res = await request(app)
    .post('/api/user/register')
    .send({ email, password })
  return res.body.accessToken
}

// Registra usuario y crea compañía
const setupUserWithCompany = async (email = 'admin@test.com', cif = 'B12345678') => {
  const token = await registerUser(email)

  await request(app)
    .patch('/api/user/company')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Company S.L.', cif })

  return token
}

// Configura el entorno completo: usuario + compañía + cliente + proyecto
// Devuelve { token, clientId, projectId } para crear albaranes
const setupForDeliveryNote = async () => {
  const token = await setupUserWithCompany()

  // Crear cliente de prueba
  const clientRes = await request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Cliente Albaranes', cif: 'A11111111' })

  const clientId = clientRes.body.client._id

  // Crear proyecto de prueba asociado al cliente
  const projectRes = await request(app)
    .post('/api/project')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Proyecto Albaranes',
      projectCode: 'PRJ-ALB-001',
      client: clientId
    })

  const projectId = projectRes.body.project._id

  return { token, clientId, projectId }
}

// Crea un albarán básico de tipo 'hours' y devuelve la respuesta
const createHoursNote = async (token, clientId, projectId, overrides = {}) => {
  const noteData = {
    format: 'hours',
    description: 'Instalación de equipos',
    workDate: '2025-06-15',
    client: clientId,
    project: projectId,
    hours: 8,
    ...overrides
  }
  return request(app)
    .post('/api/deliverynote')
    .set('Authorization', `Bearer ${token}`)
    .send(noteData)
}

// Crea un albarán de tipo 'material' y devuelve la respuesta
const createMaterialNote = async (token, clientId, projectId, overrides = {}) => {
  const noteData = {
    format: 'material',
    description: 'Suministro de materiales de construcción',
    workDate: '2025-06-20',
    client: clientId,
    project: projectId,
    material: 'Cemento Portland',
    quantity: 50,
    unit: 'sacos',
    ...overrides
  }
  return request(app)
    .post('/api/deliverynote')
    .set('Authorization', `Bearer ${token}`)
    .send(noteData)
}

// ── POST /api/deliverynote ───────────────────────────────────────────────────
describe('POST /api/deliverynote', () => {
  // Caso feliz: crear albarán de tipo 'hours'
  it('debe crear un albarán de tipo hours correctamente', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const res = await createHoursNote(token, clientId, projectId)

    expect(res.status).toBe(201)
    // La respuesta debe tener la propiedad 'deliveryNote'
    expect(res.body).toHaveProperty('deliveryNote')
    expect(res.body.deliveryNote.format).toBe('hours')
    expect(res.body.deliveryNote.hours).toBe(8)
    expect(res.body.deliveryNote.description).toBe('Instalación de equipos')
    expect(res.body.deliveryNote).toHaveProperty('_id')
    // Por defecto no está firmado al crearse
    expect(res.body.deliveryNote.signed).toBe(false)
  })

  // Caso feliz: crear albarán de tipo 'material'
  it('debe crear un albarán de tipo material correctamente', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const res = await createMaterialNote(token, clientId, projectId)

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('deliveryNote')
    expect(res.body.deliveryNote.format).toBe('material')
    expect(res.body.deliveryNote.material).toBe('Cemento Portland')
    expect(res.body.deliveryNote.quantity).toBe(50)
    expect(res.body.deliveryNote.unit).toBe('sacos')
  })

  // Caso: albarán con lista de trabajadores
  it('debe crear un albarán con lista de trabajadores', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const res = await createHoursNote(token, clientId, projectId, {
      workers: [
        { name: 'Juan García', hours: 4 },
        { name: 'María López', hours: 4 }
      ]
    })

    expect(res.status).toBe(201)
    expect(res.body.deliveryNote.workers).toHaveLength(2)
    expect(res.body.deliveryNote.workers[0].name).toBe('Juan García')
  })

  // Error: cliente inválido (no existe en la BD) debe devolver 404
  it('debe fallar con 404 si el cliente no pertenece a la compañía', async () => {
    const { token, projectId } = await setupForDeliveryNote()

    const fakeClientId = '507f1f77bcf86cd799439011'
    const res = await createHoursNote(token, fakeClientId, projectId)

    expect(res.status).toBe(404)
  })

  // Error: proyecto inválido (no existe en la BD) debe devolver 404
  it('debe fallar con 404 si el proyecto no pertenece a la compañía', async () => {
    const { token, clientId } = await setupForDeliveryNote()

    const fakeProjectId = '507f1f77bcf86cd799439011'
    const res = await createHoursNote(token, clientId, fakeProjectId)

    expect(res.status).toBe(404)
  })

  // Error: formato inválido (ni 'hours' ni 'material') debe devolver 400
  it('debe fallar con 400 si el formato es inválido', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const res = await request(app)
      .post('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        format: 'invalido', // solo acepta 'material' o 'hours'
        description: 'Test',
        workDate: '2025-06-15',
        client: clientId,
        project: projectId
      })

    expect(res.status).toBe(400)
  })

  // Error: sin campo description obligatorio
  it('debe fallar con 400 si falta la descripción', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const res = await request(app)
      .post('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        format: 'hours',
        workDate: '2025-06-15',
        client: clientId,
        project: projectId,
        hours: 8
        // sin description
      })

    expect(res.status).toBe(400)
  })

  // Error: sin token no puede crear albaranes
  it('debe fallar con 401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .post('/api/deliverynote')
      .send({
        format: 'hours',
        description: 'Sin auth',
        workDate: '2025-06-15',
        client: '507f1f77bcf86cd799439011',
        project: '507f1f77bcf86cd799439012',
        hours: 8
      })

    expect(res.status).toBe(401)
  })
})

// ── GET /api/deliverynote ────────────────────────────────────────────────────
describe('GET /api/deliverynote', () => {
  // Caso feliz: listar albaranes con paginación
  it('debe listar los albaranes de la compañía con paginación', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    // Creamos dos albaranes
    await createHoursNote(token, clientId, projectId)
    await createMaterialNote(token, clientId, projectId)

    const res = await request(app)
      .get('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // Estructura de paginación
    expect(res.body).toHaveProperty('deliveryNotes')
    expect(res.body).toHaveProperty('totalItems')
    expect(res.body).toHaveProperty('totalPages')
    expect(res.body).toHaveProperty('currentPage')
    expect(Array.isArray(res.body.deliveryNotes)).toBe(true)
    expect(res.body.totalItems).toBe(2)
  })

  // Caso: lista vacía cuando no hay albaranes
  it('debe devolver lista vacía si no hay albaranes', async () => {
    const token = await setupUserWithCompany()

    const res = await request(app)
      .get('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deliveryNotes).toHaveLength(0)
    expect(res.body.totalItems).toBe(0)
  })

  // Caso: filtrar por formato 'hours'
  it('debe filtrar albaranes por formato', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    await createHoursNote(token, clientId, projectId)
    await createMaterialNote(token, clientId, projectId)

    // Filtramos solo los de tipo 'hours'
    const res = await request(app)
      .get('/api/deliverynote?format=hours')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.totalItems).toBe(1)
    expect(res.body.deliveryNotes[0].format).toBe('hours')
  })

  // Caso: paginación funciona correctamente
  it('debe respetar los parámetros de paginación', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    // Creamos 3 albaranes
    await createHoursNote(token, clientId, projectId, { description: 'Albarán 1' })
    await createHoursNote(token, clientId, projectId, { description: 'Albarán 2' })
    await createHoursNote(token, clientId, projectId, { description: 'Albarán 3' })

    // Pedimos solo 2 por página
    const res = await request(app)
      .get('/api/deliverynote?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deliveryNotes).toHaveLength(2)
    expect(res.body.totalItems).toBe(3)
    expect(res.body.totalPages).toBe(2)
    expect(res.body.currentPage).toBe(1)
  })

  // Error: sin token no puede listar
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/deliverynote')

    expect(res.status).toBe(401)
  })
})

// ── GET /api/deliverynote/:id ─────────────────────────────────────────────────
describe('GET /api/deliverynote/:id', () => {
  // Caso feliz: obtener un albarán por ID con datos populados
  it('debe devolver un albarán por su ID con datos populados', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const createRes = await createHoursNote(token, clientId, projectId)
    const noteId = createRes.body.deliveryNote._id

    const res = await request(app)
      .get(`/api/deliverynote/${noteId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('deliveryNote')
    expect(res.body.deliveryNote._id).toBe(noteId)
    // El cliente debe estar populado (nombre y cif)
    expect(res.body.deliveryNote.client).toHaveProperty('name')
    expect(res.body.deliveryNote.client).toHaveProperty('cif')
    // El proyecto debe estar populado (nombre y código)
    expect(res.body.deliveryNote.project).toHaveProperty('name')
    expect(res.body.deliveryNote.project).toHaveProperty('projectCode')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el albarán no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .get(`/api/deliverynote/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede obtener el albarán
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).get(`/api/deliverynote/${fakeId}`)

    expect(res.status).toBe(401)
  })
})

// ── GET /api/deliverynote/pdf/:id ─────────────────────────────────────────────
describe('GET /api/deliverynote/pdf/:id', () => {
  // Caso feliz: generar PDF al vuelo de un albarán sin pdfUrl guardada
  // El controlador genera el PDF con pdfkit y lo devuelve como application/pdf
  it('debe generar y devolver el PDF de un albarán', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    // Creamos un albarán de tipo hours con trabajadores
    const createRes = await createHoursNote(token, clientId, projectId, {
      description: 'Trabajo de fontanería',
      workers: [{ name: 'Pepe Fontanero', hours: 6 }]
    })
    const noteId = createRes.body.deliveryNote._id

    // Descargamos el PDF generado al vuelo
    const res = await request(app)
      .get(`/api/deliverynote/pdf/${noteId}`)
      .set('Authorization', `Bearer ${token}`)

    // El response debe ser un PDF binario con el content-type correcto
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    // El cuerpo debe ser un Buffer con datos (el PDF no está vacío)
    expect(res.body).toBeTruthy()
  })

  // Caso: PDF para albarán de tipo material
  it('debe generar PDF para un albarán de tipo material', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const createRes = await createMaterialNote(token, clientId, projectId)
    const noteId = createRes.body.deliveryNote._id

    const res = await request(app)
      .get(`/api/deliverynote/pdf/${noteId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el albarán no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .get(`/api/deliverynote/pdf/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede descargar el PDF
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).get(`/api/deliverynote/pdf/${fakeId}`)

    expect(res.status).toBe(401)
  })
})

// ── DELETE /api/deliverynote/:id ──────────────────────────────────────────────
describe('DELETE /api/deliverynote/:id', () => {
  // Caso feliz: borrar un albarán no firmado
  it('debe eliminar un albarán no firmado correctamente', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const createRes = await createHoursNote(token, clientId, projectId)
    const noteId = createRes.body.deliveryNote._id

    const res = await request(app)
      .delete(`/api/deliverynote/${noteId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('eliminado')

    // Verificamos que ya no existe en la BD
    const getRes = await request(app)
      .get(`/api/deliverynote/${noteId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(getRes.status).toBe(404)
  })

  // Error: intentar borrar un albarán firmado debe devolver 400
  it('debe fallar con 400 al intentar borrar un albarán firmado', async () => {
    const { token, clientId, projectId } = await setupForDeliveryNote()

    const createRes = await createHoursNote(token, clientId, projectId)
    const noteId = createRes.body.deliveryNote._id

    // Marcamos el albarán como firmado directamente en la BD
    // (el endpoint de firma requiere Supabase, así que lo hacemos a nivel de modelo)
    const DeliveryNote = (await import('../src/models/DeliveryNote.js')).default
    await DeliveryNote.findByIdAndUpdate(noteId, {
      signed: true,
      signedAt: new Date(),
      signatureUrl: 'https://example.com/signature.webp'
    })

    // Intentamos borrar el albarán firmado
    const res = await request(app)
      .delete(`/api/deliverynote/${noteId}`)
      .set('Authorization', `Bearer ${token}`)

    // El controlador rechaza el borrado de albaranes firmados
    expect(res.status).toBe(400)
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el albarán no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .delete(`/api/deliverynote/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede borrar
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).delete(`/api/deliverynote/${fakeId}`)

    expect(res.status).toBe(401)
  })
})

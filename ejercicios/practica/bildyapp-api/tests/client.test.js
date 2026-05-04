// tests/client.test.js
// Tests de integración para todos los endpoints de /api/client
// Cada test crea sus propios datos desde cero gracias al clearTestDB() en afterEach

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

// Registra usuario, crea compañía, y devuelve el token con permisos para /api/client
const setupUserWithCompany = async (
  email = 'admin@test.com',
  cif = 'B12345678'
) => {
  const token = await registerUser(email)

  // Creamos la compañía asociada al usuario
  await request(app)
    .patch('/api/user/company')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Company S.L.', cif })

  return token
}

// Crea un cliente básico y devuelve la respuesta completa
const createTestClient = async (token, overrides = {}) => {
  const clientData = {
    name: 'Cliente Test S.A.',
    cif: 'A11111111',
    email: 'cliente@test.com',
    phone: '600000000',
    ...overrides
  }
  return request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send(clientData)
}

// ── POST /api/client ─────────────────────────────────────────────────────────
describe('POST /api/client', () => {
  // Caso feliz: crear cliente devuelve 201 con los datos del cliente
  it('debe crear un cliente correctamente', async () => {
    const token = await setupUserWithCompany()

    const res = await createTestClient(token)

    expect(res.status).toBe(201)
    // La respuesta debe tener la propiedad 'client' con los datos
    expect(res.body).toHaveProperty('client')
    expect(res.body.client.name).toBe('Cliente Test S.A.')
    expect(res.body.client.cif).toBe('A11111111')
    // Debe tener el id de MongoDB asignado
    expect(res.body.client).toHaveProperty('_id')
  })

  // Error: CIF duplicado dentro de la misma compañía debe devolver 409
  it('debe fallar con 409 si el CIF ya existe en la compañía', async () => {
    const token = await setupUserWithCompany()

    // Creamos el primer cliente
    await createTestClient(token, { cif: 'A22222222' })

    // Intentamos crear otro con el mismo CIF
    const res = await createTestClient(token, { name: 'Otro Cliente', cif: 'A22222222' })

    expect(res.status).toBe(409)
  })

  // Error: falta el campo 'name' obligatorio debe devolver 400
  it('debe fallar con 400 si falta el campo name', async () => {
    const token = await setupUserWithCompany()

    const res = await request(app)
      .post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ cif: 'A33333333' }) // sin name

    expect(res.status).toBe(400)
  })

  // Error: falta el campo 'cif' obligatorio debe devolver 400
  it('debe fallar con 400 si falta el campo cif', async () => {
    const token = await setupUserWithCompany()

    const res = await request(app)
      .post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Sin CIF' }) // sin cif

    expect(res.status).toBe(400)
  })

  // Error: sin token no puede crear clientes
  it('debe fallar con 401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .post('/api/client')
      .send({ name: 'Cliente Sin Auth', cif: 'A44444444' })

    expect(res.status).toBe(401)
  })
})

// ── GET /api/client ──────────────────────────────────────────────────────────
describe('GET /api/client', () => {
  // Caso feliz: listar clientes con paginación
  it('debe listar los clientes activos con paginación', async () => {
    const token = await setupUserWithCompany()

    // Creamos dos clientes de prueba
    await createTestClient(token, { name: 'Cliente Uno', cif: 'A55555551' })
    await createTestClient(token, { name: 'Cliente Dos', cif: 'A55555552' })

    const res = await request(app)
      .get('/api/client')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // La respuesta debe tener la estructura de paginación
    expect(res.body).toHaveProperty('clients')
    expect(res.body).toHaveProperty('totalItems')
    expect(res.body).toHaveProperty('totalPages')
    expect(res.body).toHaveProperty('currentPage')
    expect(Array.isArray(res.body.clients)).toBe(true)
    // Deben aparecer los 2 clientes creados
    expect(res.body.totalItems).toBe(2)
  })

  // Caso: lista vacía cuando no hay clientes
  it('debe devolver una lista vacía si no hay clientes', async () => {
    const token = await setupUserWithCompany()

    const res = await request(app)
      .get('/api/client')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.clients).toHaveLength(0)
    expect(res.body.totalItems).toBe(0)
  })

  // Caso: filtrado por nombre
  it('debe filtrar clientes por nombre', async () => {
    const token = await setupUserWithCompany()

    await createTestClient(token, { name: 'Empresa ABC', cif: 'A66666661' })
    await createTestClient(token, { name: 'Empresa XYZ', cif: 'A66666662' })

    // Filtramos solo por "ABC"
    const res = await request(app)
      .get('/api/client?name=ABC')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.totalItems).toBe(1)
    expect(res.body.clients[0].name).toBe('Empresa ABC')
  })

  // Error: sin token no puede listar clientes
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/client')

    expect(res.status).toBe(401)
  })
})

// ── GET /api/client/archived ─────────────────────────────────────────────────
describe('GET /api/client/archived', () => {
  // Caso feliz: listar clientes archivados (con soft delete activo)
  it('debe listar los clientes archivados', async () => {
    const token = await setupUserWithCompany()

    // Creamos un cliente y lo archivamos con soft delete
    const createRes = await createTestClient(token, { cif: 'A77777771' })
    const clientId = createRes.body.client._id

    await request(app)
      .delete(`/api/client/${clientId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    // Ahora debería aparecer en la lista de archivados
    const res = await request(app)
      .get('/api/client/archived')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('clients')
    expect(Array.isArray(res.body.clients)).toBe(true)
    expect(res.body.totalItems).toBe(1)
  })

  // Error: sin token no puede listar archivados
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/client/archived')

    expect(res.status).toBe(401)
  })
})

// ── GET /api/client/:id ──────────────────────────────────────────────────────
describe('GET /api/client/:id', () => {
  // Caso feliz: obtener un cliente por su ID
  it('debe devolver un cliente existente por su ID', async () => {
    const token = await setupUserWithCompany()

    const createRes = await createTestClient(token, { cif: 'A88888881' })
    const clientId = createRes.body.client._id

    const res = await request(app)
      .get(`/api/client/${clientId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('client')
    expect(res.body.client._id).toBe(clientId)
    expect(res.body.client.cif).toBe('A88888881')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el cliente no existe', async () => {
    const token = await setupUserWithCompany()

    // Usamos un ObjectId válido pero que no existe en la BD
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .get(`/api/client/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede obtener el cliente
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).get(`/api/client/${fakeId}`)

    expect(res.status).toBe(401)
  })
})

// ── PUT /api/client/:id ──────────────────────────────────────────────────────
describe('PUT /api/client/:id', () => {
  // Caso feliz: actualizar el nombre de un cliente
  it('debe actualizar un cliente correctamente', async () => {
    const token = await setupUserWithCompany()

    const createRes = await createTestClient(token, { name: 'Nombre Original', cif: 'A99999991' })
    const clientId = createRes.body.client._id

    const res = await request(app)
      .put(`/api/client/${clientId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nombre Actualizado' })

    expect(res.status).toBe(200)
    expect(res.body.client.name).toBe('Nombre Actualizado')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el cliente a actualizar no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .put(`/api/client/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo nombre' })

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede actualizar
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .put(`/api/client/${fakeId}`)
      .send({ name: 'Sin auth' })

    expect(res.status).toBe(401)
  })
})

// ── DELETE /api/client/:id ───────────────────────────────────────────────────
describe('DELETE /api/client/:id', () => {
  // Caso feliz: borrado lógico con ?soft=true
  it('debe archivar el cliente con ?soft=true', async () => {
    const token = await setupUserWithCompany()

    const createRes = await createTestClient(token, { cif: 'B11111111' })
    const clientId = createRes.body.client._id

    const res = await request(app)
      .delete(`/api/client/${clientId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('archivado')

    // El cliente ya no debe aparecer en la lista activa
    const listRes = await request(app)
      .get('/api/client')
      .set('Authorization', `Bearer ${token}`)
    expect(listRes.body.totalItems).toBe(0)
  })

  // Caso feliz: borrado físico (hard delete) sin ?soft
  it('debe eliminar permanentemente el cliente sin parámetro soft', async () => {
    const token = await setupUserWithCompany()

    const createRes = await createTestClient(token, { cif: 'B22222222' })
    const clientId = createRes.body.client._id

    const res = await request(app)
      .delete(`/api/client/${clientId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('eliminado')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el cliente a eliminar no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .delete(`/api/client/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/client/:id/restore ────────────────────────────────────────────
describe('PATCH /api/client/:id/restore', () => {
  // Caso feliz: restaurar un cliente previamente archivado
  it('debe restaurar un cliente archivado correctamente', async () => {
    const token = await setupUserWithCompany()

    // Creamos y archivamos un cliente
    const createRes = await createTestClient(token, { cif: 'B33333333' })
    const clientId = createRes.body.client._id

    await request(app)
      .delete(`/api/client/${clientId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    // Ahora lo restauramos
    const res = await request(app)
      .patch(`/api/client/${clientId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('client')
    expect(res.body.message).toContain('restaurado')

    // Debe aparecer de nuevo en la lista activa
    const listRes = await request(app)
      .get('/api/client')
      .set('Authorization', `Bearer ${token}`)
    expect(listRes.body.totalItems).toBe(1)
  })

  // Error: intentar restaurar un cliente que no está archivado (no existe en deleted=true)
  it('debe fallar con 404 si el cliente no está archivado', async () => {
    const token = await setupUserWithCompany()

    // Cliente activo (no archivado)
    const createRes = await createTestClient(token, { cif: 'B44444444' })
    const clientId = createRes.body.client._id

    // Intentamos restaurar un cliente activo (no está en deleted=true)
    const res = await request(app)
      .patch(`/api/client/${clientId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede restaurar
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).patch(`/api/client/${fakeId}/restore`)

    expect(res.status).toBe(401)
  })
})

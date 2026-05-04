// tests/project.test.js
// Tests de integración para todos los endpoints de /api/project
// Cada test necesita usuario + compañía + cliente previos, creados por los helpers

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

// Registra usuario y crea compañía, devuelve el token
const setupUserWithCompany = async (email = 'admin@test.com', cif = 'B12345678') => {
  const token = await registerUser(email)

  await request(app)
    .patch('/api/user/company')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Company S.L.', cif })

  return token
}

// Crea usuario + compañía + cliente de prueba
// Devuelve { token, clientId } para usarlo en los tests de proyectos
const setupWithClient = async () => {
  const token = await setupUserWithCompany()

  // Creamos un cliente de prueba asociado a la compañía
  const clientRes = await request(app)
    .post('/api/client')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Cliente Para Proyectos', cif: 'A11111111' })

  return { token, clientId: clientRes.body.client._id }
}

// Crea un proyecto básico de prueba y devuelve la respuesta completa
const createTestProject = async (token, clientId, overrides = {}) => {
  const projectData = {
    name: 'Proyecto Test',
    projectCode: 'PRJ-001',
    client: clientId,
    notes: 'Proyecto de prueba',
    ...overrides
  }
  return request(app)
    .post('/api/project')
    .set('Authorization', `Bearer ${token}`)
    .send(projectData)
}

// ── POST /api/project ────────────────────────────────────────────────────────
describe('POST /api/project', () => {
  // Caso feliz: crear un proyecto correctamente
  it('debe crear un proyecto correctamente', async () => {
    const { token, clientId } = await setupWithClient()

    const res = await createTestProject(token, clientId)

    expect(res.status).toBe(201)
    // La respuesta debe contener el proyecto creado
    expect(res.body).toHaveProperty('project')
    expect(res.body.project.name).toBe('Proyecto Test')
    expect(res.body.project.projectCode).toBe('PRJ-001')
    // El proyecto debe referenciar el cliente correcto
    expect(res.body.project.client.toString()).toBe(clientId.toString())
    expect(res.body.project).toHaveProperty('_id')
  })

  // Error: código de proyecto duplicado dentro de la misma compañía debe devolver 409
  it('debe fallar con 409 si el código de proyecto ya existe en la compañía', async () => {
    const { token, clientId } = await setupWithClient()

    // Creamos el primer proyecto con un código
    await createTestProject(token, clientId, { projectCode: 'PRJ-DUP' })

    // Intentamos crear otro con el mismo código
    const res = await createTestProject(token, clientId, {
      name: 'Otro Proyecto',
      projectCode: 'PRJ-DUP' // mismo código
    })

    expect(res.status).toBe(409)
  })

  // Error: cliente inválido (ObjectId que no existe) debe devolver 404
  it('debe fallar con 404 si el cliente no existe', async () => {
    const token = await setupUserWithCompany()

    // Usamos un ObjectId válido pero inexistente en la BD
    const fakeClientId = '507f1f77bcf86cd799439011'

    const res = await createTestProject(token, fakeClientId)

    expect(res.status).toBe(404)
  })

  // Error: falta el campo name obligatorio
  it('debe fallar con 400 si falta el campo name', async () => {
    const { token, clientId } = await setupWithClient()

    const res = await request(app)
      .post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectCode: 'PRJ-NONAME', client: clientId }) // sin name

    expect(res.status).toBe(400)
  })

  // Error: falta el campo projectCode obligatorio
  it('debe fallar con 400 si falta el campo projectCode', async () => {
    const { token, clientId } = await setupWithClient()

    const res = await request(app)
      .post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sin Código', client: clientId }) // sin projectCode

    expect(res.status).toBe(400)
  })

  // Error: sin token no puede crear proyectos
  it('debe fallar con 401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .post('/api/project')
      .send({ name: 'Sin Auth', projectCode: 'PRJ-NOAUTH', client: '507f1f77bcf86cd799439011' })

    expect(res.status).toBe(401)
  })
})

// ── GET /api/project ─────────────────────────────────────────────────────────
describe('GET /api/project', () => {
  // Caso feliz: listar proyectos con paginación
  it('debe listar los proyectos activos con paginación', async () => {
    const { token, clientId } = await setupWithClient()

    // Creamos dos proyectos de prueba
    await createTestProject(token, clientId, { projectCode: 'PRJ-LST-1', name: 'Proyecto Uno' })
    await createTestProject(token, clientId, { projectCode: 'PRJ-LST-2', name: 'Proyecto Dos' })

    const res = await request(app)
      .get('/api/project')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // Estructura de paginación completa
    expect(res.body).toHaveProperty('projects')
    expect(res.body).toHaveProperty('totalItems')
    expect(res.body).toHaveProperty('totalPages')
    expect(res.body).toHaveProperty('currentPage')
    expect(Array.isArray(res.body.projects)).toBe(true)
    expect(res.body.totalItems).toBe(2)
  })

  // Caso: lista vacía cuando no hay proyectos
  it('debe devolver una lista vacía si no hay proyectos', async () => {
    const token = await setupUserWithCompany()

    const res = await request(app)
      .get('/api/project')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.projects).toHaveLength(0)
    expect(res.body.totalItems).toBe(0)
  })

  // Caso: filtrado por nombre
  it('debe filtrar proyectos por nombre', async () => {
    const { token, clientId } = await setupWithClient()

    await createTestProject(token, clientId, { projectCode: 'PRJ-FILT-1', name: 'Reforma Oficina' })
    await createTestProject(token, clientId, { projectCode: 'PRJ-FILT-2', name: 'Construcción Local' })

    // Filtramos por "Reforma"
    const res = await request(app)
      .get('/api/project?name=Reforma')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.totalItems).toBe(1)
    expect(res.body.projects[0].name).toBe('Reforma Oficina')
  })

  // Error: sin token no puede listar proyectos
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/project')

    expect(res.status).toBe(401)
  })
})

// ── GET /api/project/archived ─────────────────────────────────────────────────
describe('GET /api/project/archived', () => {
  // Caso feliz: listar proyectos archivados
  it('debe listar los proyectos archivados', async () => {
    const { token, clientId } = await setupWithClient()

    // Creamos un proyecto y lo archivamos
    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-ARC' })
    const projectId = createRes.body.project._id

    await request(app)
      .delete(`/api/project/${projectId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    // Ahora debe aparecer en los archivados
    const res = await request(app)
      .get('/api/project/archived')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('projects')
    expect(Array.isArray(res.body.projects)).toBe(true)
    expect(res.body.totalItems).toBe(1)
  })

  // Error: sin token no puede acceder
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/project/archived')

    expect(res.status).toBe(401)
  })
})

// ── GET /api/project/:id ─────────────────────────────────────────────────────
describe('GET /api/project/:id', () => {
  // Caso feliz: obtener un proyecto por su ID con datos populados
  it('debe devolver un proyecto existente por su ID', async () => {
    const { token, clientId } = await setupWithClient()

    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-GETID' })
    const projectId = createRes.body.project._id

    const res = await request(app)
      .get(`/api/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('project')
    expect(res.body.project._id).toBe(projectId)
    // El cliente debe estar populado con nombre y cif
    expect(res.body.project.client).toHaveProperty('name')
    expect(res.body.project.client).toHaveProperty('cif')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el proyecto no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .get(`/api/project/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede obtener el proyecto
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).get(`/api/project/${fakeId}`)

    expect(res.status).toBe(401)
  })
})

// ── PUT /api/project/:id ─────────────────────────────────────────────────────
describe('PUT /api/project/:id', () => {
  // Caso feliz: actualizar el nombre de un proyecto
  it('debe actualizar un proyecto correctamente', async () => {
    const { token, clientId } = await setupWithClient()

    const createRes = await createTestProject(token, clientId, {
      projectCode: 'PRJ-UPD',
      name: 'Nombre Original'
    })
    const projectId = createRes.body.project._id

    const res = await request(app)
      .put(`/api/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nombre Actualizado' })

    expect(res.status).toBe(200)
    expect(res.body.project.name).toBe('Nombre Actualizado')
    // El resto de datos no debe cambiar
    expect(res.body.project.projectCode).toBe('PRJ-UPD')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el proyecto a actualizar no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .put(`/api/project/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo nombre' })

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede actualizar
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .put(`/api/project/${fakeId}`)
      .send({ name: 'Sin auth' })

    expect(res.status).toBe(401)
  })
})

// ── DELETE /api/project/:id ──────────────────────────────────────────────────
describe('DELETE /api/project/:id', () => {
  // Caso feliz: borrado lógico con ?soft=true
  it('debe archivar el proyecto con ?soft=true', async () => {
    const { token, clientId } = await setupWithClient()

    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-SDEL' })
    const projectId = createRes.body.project._id

    const res = await request(app)
      .delete(`/api/project/${projectId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('archivado')

    // El proyecto no debe aparecer en la lista activa
    const listRes = await request(app)
      .get('/api/project')
      .set('Authorization', `Bearer ${token}`)
    expect(listRes.body.totalItems).toBe(0)
  })

  // Caso feliz: borrado físico (hard delete)
  it('debe eliminar permanentemente el proyecto sin parámetro soft', async () => {
    const { token, clientId } = await setupWithClient()

    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-HDEL' })
    const projectId = createRes.body.project._id

    const res = await request(app)
      .delete(`/api/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('eliminado')
  })

  // Error: ID inexistente debe devolver 404
  it('debe fallar con 404 si el proyecto a eliminar no existe', async () => {
    const token = await setupUserWithCompany()

    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app)
      .delete(`/api/project/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/project/:id/restore ───────────────────────────────────────────
describe('PATCH /api/project/:id/restore', () => {
  // Caso feliz: restaurar un proyecto previamente archivado
  it('debe restaurar un proyecto archivado correctamente', async () => {
    const { token, clientId } = await setupWithClient()

    // Creamos y archivamos un proyecto
    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-RST' })
    const projectId = createRes.body.project._id

    await request(app)
      .delete(`/api/project/${projectId}?soft=true`)
      .set('Authorization', `Bearer ${token}`)

    // Restauramos el proyecto
    const res = await request(app)
      .patch(`/api/project/${projectId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('project')
    expect(res.body.message).toContain('restaurado')

    // El proyecto debe volver a aparecer en la lista activa
    const listRes = await request(app)
      .get('/api/project')
      .set('Authorization', `Bearer ${token}`)
    expect(listRes.body.totalItems).toBe(1)
  })

  // Error: intentar restaurar un proyecto que no está archivado
  it('debe fallar con 404 si el proyecto no está archivado', async () => {
    const { token, clientId } = await setupWithClient()

    // Proyecto activo (no archivado)
    const createRes = await createTestProject(token, clientId, { projectCode: 'PRJ-NOTARC' })
    const projectId = createRes.body.project._id

    // Intentamos restaurar un proyecto activo
    const res = await request(app)
      .patch(`/api/project/${projectId}/restore`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  // Error: sin token no puede restaurar
  it('debe fallar con 401 si no hay token', async () => {
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await request(app).patch(`/api/project/${fakeId}/restore`)

    expect(res.status).toBe(401)
  })
})

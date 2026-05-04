// tests/dashboard.test.js
// Tests para el endpoint de estadísticas GET /api/dashboard

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

// Helper: crea un usuario con empresa y devuelve el token
const crearUsuarioConEmpresa = async () => {
  const registro = await request(app)
    .post('/api/user/register')
    .send({ email: 'dashboard@test.com', password: 'password123' })

  const token = registro.body.accessToken

  await request(app)
    .patch('/api/user/company')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Empresa Dashboard', cif: 'D11111111' })

  return token
}

describe('GET /api/dashboard', () => {
  it('debe devolver estadísticas vacías para una empresa nueva', async () => {
    const token = await crearUsuarioConEmpresa()

    const respuesta = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`)

    expect(respuesta.status).toBe(200)
    // La respuesta debe tener las cuatro secciones
    expect(respuesta.body).toHaveProperty('totals')
    expect(respuesta.body).toHaveProperty('notesByMonth')
    expect(respuesta.body).toHaveProperty('hoursByProject')
    expect(respuesta.body).toHaveProperty('materialsByClient')
    // Con empresa nueva no hay albaranes
    expect(Array.isArray(respuesta.body.notesByMonth)).toBe(true)
    expect(respuesta.body.notesByMonth).toHaveLength(0)
  })

  it('debe fallar sin token de autenticación', async () => {
    const respuesta = await request(app)
      .get('/api/dashboard')

    expect(respuesta.status).toBe(401)
  })

  it('debe mostrar estadísticas con albaranes creados', async () => {
    const token = await crearUsuarioConEmpresa()

    // Creamos un cliente y un proyecto primero
    const clienteRes = await request(app)
      .post('/api/client')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Stats', cif: 'C22222222' })

    const clienteId = clienteRes.body.client._id

    const proyectoRes = await request(app)
      .post('/api/project')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Proyecto Stats', projectCode: 'STATS-001', client: clienteId })

    const proyectoId = proyectoRes.body.project._id

    // Creamos un albarán de horas
    await request(app)
      .post('/api/deliverynote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project: proyectoId,
        client: clienteId,
        format: 'hours',
        description: 'Trabajo de prueba',
        workDate: '2026-05-05',
        hours: 6
      })

    // Consultamos el dashboard
    const respuesta = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`)

    expect(respuesta.status).toBe(200)
    // Ahora debe haber datos en los arrays
    expect(respuesta.body.totals.totalNotes).toBe(1)
    expect(respuesta.body.totals.totalHours).toBe(6)
    expect(respuesta.body.notesByMonth).toHaveLength(1)
    expect(respuesta.body.hoursByProject).toHaveLength(1)
  })
})

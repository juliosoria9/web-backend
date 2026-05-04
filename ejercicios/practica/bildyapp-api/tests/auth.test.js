// tests/auth.test.js
// Tests de integración para todos los endpoints de /api/user
// Usamos mongodb-memory-server para una BD en memoria que se limpia entre tests

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import request from 'supertest'
import app from '../src/app.js'
import { connectTestDB, disconnectTestDB, clearTestDB } from './setup.js'

// Arrancamos la BD en memoria antes de todos los tests de este archivo
beforeAll(async () => {
  await connectTestDB()
})

// Paramos la BD en memoria al terminar todos los tests
afterAll(async () => {
  await disconnectTestDB()
})

// Limpiamos todas las colecciones después de cada test individual
// para que no haya datos residuales que contaminen el siguiente test
afterEach(async () => {
  await clearTestDB()
})

// ── Helper reutilizable ──────────────────────────────────────────────────────
// Registra un usuario y devuelve su accessToken y los datos del body
// Esto evita repetir el código de registro en cada test que necesita auth
const registerUser = async (email = 'test@test.com', password = 'password123') => {
  const res = await request(app)
    .post('/api/user/register')
    .send({ email, password })
  return res.body
}

// ── POST /api/user/register ──────────────────────────────────────────────────
describe('POST /api/user/register', () => {
  // Caso feliz: registro correcto devuelve 201 con token y datos del usuario
  it('debe registrar un usuario nuevo correctamente', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ email: 'nuevo@test.com', password: 'password123' })

    expect(res.status).toBe(201)
    // El body debe contener el accessToken para autenticar futuras peticiones
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    // Los datos del usuario deben estar presentes pero sin la contraseña
    expect(res.body.user.email).toBe('nuevo@test.com')
    expect(res.body.user).toHaveProperty('status')
    expect(res.body.user).not.toHaveProperty('password')
  })

  // Error: email duplicado que ya está verificado debe devolver 409
  it('debe fallar con 409 si el email ya está verificado', async () => {
    // Primero registramos el usuario y lo verificamos manualmente vía BD
    const regRes = await request(app)
      .post('/api/user/register')
      .send({ email: 'duplicado@test.com', password: 'password123' })

    const token = regRes.body.accessToken

    // Obtenemos el código de verificación del usuario recién creado
    // Para ello leemos el usuario de la BD (importamos el modelo directamente)
    const User = (await import('../src/models/User.js')).default
    const user = await User.findOne({ email: 'duplicado@test.com' })
    const code = user.verificationCode

    // Verificamos el email con el código correcto
    await request(app)
      .put('/api/user/validation')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })

    // Intentamos registrar de nuevo el mismo email verificado
    const res = await request(app)
      .post('/api/user/register')
      .send({ email: 'duplicado@test.com', password: 'otrapassword123' })

    expect(res.status).toBe(409)
  })

  // Error: sin password el validador de Zod debe devolver 400
  it('debe fallar con 400 si falta la contraseña', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ email: 'sinpassword@test.com' })

    expect(res.status).toBe(400)
  })

  // Error: sin email el validador de Zod debe devolver 400
  it('debe fallar con 400 si el email es inválido', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ email: 'noesinemail', password: 'password123' })

    expect(res.status).toBe(400)
  })

  // Error: contraseña muy corta (menos de 8 caracteres)
  it('debe fallar con 400 si la contraseña tiene menos de 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ email: 'corta@test.com', password: 'abc' })

    expect(res.status).toBe(400)
  })
})

// ── POST /api/user/login ─────────────────────────────────────────────────────
describe('POST /api/user/login', () => {
  // Caso feliz: login correcto devuelve 200 con tokens
  it('debe hacer login correctamente con credenciales válidas', async () => {
    // Primero registramos el usuario para que exista en la BD
    await registerUser('login@test.com', 'password123')

    const res = await request(app)
      .post('/api/user/login')
      .send({ email: 'login@test.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body.user.email).toBe('login@test.com')
  })

  // Error: contraseña incorrecta debe devolver 401
  it('debe fallar con 401 si la contraseña es incorrecta', async () => {
    await registerUser('wrongpass@test.com', 'password123')

    const res = await request(app)
      .post('/api/user/login')
      .send({ email: 'wrongpass@test.com', password: 'contraseñaerronea' })

    expect(res.status).toBe(401)
  })

  // Error: usuario que no existe debe devolver 401 (mismo mensaje por seguridad)
  it('debe fallar con 401 si el usuario no existe', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ email: 'noexiste@test.com', password: 'password123' })

    expect(res.status).toBe(401)
  })

  // Error: sin email debe devolver 400
  it('debe fallar con 400 si faltan credenciales', async () => {
    const res = await request(app)
      .post('/api/user/login')
      .send({ password: 'password123' })

    expect(res.status).toBe(400)
  })
})

// ── PUT /api/user/validation ─────────────────────────────────────────────────
describe('PUT /api/user/validation', () => {
  // Caso feliz: validar email con el código correcto
  it('debe validar el email con el código correcto', async () => {
    const { accessToken } = await registerUser('validar@test.com')

    // Buscamos el código de verificación en la BD
    const User = (await import('../src/models/User.js')).default
    const user = await User.findOne({ email: 'validar@test.com' })
    const code = user.verificationCode

    const res = await request(app)
      .put('/api/user/validation')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')
  })

  // Error: código incorrecto debe devolver 400 con intentos restantes
  it('debe fallar con 400 si el código es incorrecto', async () => {
    const { accessToken } = await registerUser('codigomal@test.com')

    const res = await request(app)
      .put('/api/user/validation')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' }) // código incorrecto

    expect(res.status).toBe(400)
  })

  // Error: sin token debe devolver 401
  it('debe fallar con 401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .put('/api/user/validation')
      .send({ code: '123456' })

    expect(res.status).toBe(401)
  })

  // Error: código con formato inválido (no 6 dígitos) debe devolver 400
  it('debe fallar con 400 si el código no tiene 6 dígitos numéricos', async () => {
    const { accessToken } = await registerUser('formatomal@test.com')

    const res = await request(app)
      .put('/api/user/validation')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'abc' }) // no son 6 dígitos numéricos

    expect(res.status).toBe(400)
  })
})

// ── PUT /api/user/register — actualizar datos personales ────────────────────
describe('PUT /api/user/register (datos personales)', () => {
  // Caso feliz: actualizar nombre, apellidos y NIF
  it('debe actualizar los datos personales del usuario autenticado', async () => {
    const { accessToken } = await registerUser('personal@test.com')

    const res = await request(app)
      .put('/api/user/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Juan', lastName: 'García López', nif: '12345678A' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Juan')
    expect(res.body.user.lastName).toBe('García López')
  })

  // Error: sin token no puede actualizar
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app)
      .put('/api/user/register')
      .send({ name: 'Test', lastName: 'User', nif: '00000000X' })

    expect(res.status).toBe(401)
  })

  // Error: falta algún campo obligatorio (name)
  it('debe fallar con 400 si falta el campo name', async () => {
    const { accessToken } = await registerUser('faltaname@test.com')

    const res = await request(app)
      .put('/api/user/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lastName: 'García', nif: '12345678A' }) // falta name

    expect(res.status).toBe(400)
  })
})

// ── PATCH /api/user/company ──────────────────────────────────────────────────
describe('PATCH /api/user/company', () => {
  // Caso feliz: crear una compañía para el usuario
  it('debe crear la compañía del usuario correctamente', async () => {
    const { accessToken } = await registerUser('empresa@test.com')

    const res = await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Mi Empresa S.L.', cif: 'B12345678' })

    expect(res.status).toBe(200)
    // El response incluye el usuario con la compañía populada
    expect(res.body.user).toHaveProperty('company')
  })

  // Error: intentar crear una segunda compañía para el mismo usuario
  it('debe fallar con 409 si el usuario ya tiene una compañía', async () => {
    const { accessToken } = await registerUser('empresa2@test.com')

    // Primera compañía
    await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Primera Empresa', cif: 'B98765432' })

    // Intentamos crear una segunda
    const res = await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Segunda Empresa', cif: 'B11111111' })

    expect(res.status).toBe(409)
  })

  // Error: sin token no puede crear compañía
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app)
      .patch('/api/user/company')
      .send({ name: 'Empresa Sin Auth', cif: 'B00000000' })

    expect(res.status).toBe(401)
  })

  // Error: faltan campos obligatorios (cif)
  it('debe fallar con 400 si falta el campo cif', async () => {
    const { accessToken } = await registerUser('sincif@test.com')

    const res = await request(app)
      .patch('/api/user/company')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Empresa Sin CIF' }) // falta cif

    expect(res.status).toBe(400)
  })
})

// ── GET /api/user ────────────────────────────────────────────────────────────
describe('GET /api/user', () => {
  // Caso feliz: obtener los datos del usuario autenticado
  it('debe devolver los datos del usuario autenticado', async () => {
    const { accessToken } = await registerUser('getuser@test.com')

    const res = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('user')
    expect(res.body.user.email).toBe('getuser@test.com')
    // No debe exponer la contraseña en la respuesta
    expect(res.body.user).not.toHaveProperty('password')
  })

  // Error: sin token no puede obtener datos
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/user')

    expect(res.status).toBe(401)
  })
})

// ── DELETE /api/user ─────────────────────────────────────────────────────────
describe('DELETE /api/user', () => {
  // Caso feliz: borrado lógico con ?soft=true
  it('debe hacer soft delete del usuario con ?soft=true', async () => {
    const { accessToken } = await registerUser('softdelete@test.com')

    const res = await request(app)
      .delete('/api/user?soft=true')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // Verificamos que el usuario queda marcado como deleted pero sigue en BD
    const User = (await import('../src/models/User.js')).default
    const user = await User.findOne({ email: 'softdelete@test.com' })
    expect(user).not.toBeNull()
    expect(user.deleted).toBe(true)
  })

  // Caso feliz: borrado físico (hard delete) sin query param
  it('debe hacer hard delete del usuario sin parámetro soft', async () => {
    const { accessToken } = await registerUser('harddelete@test.com')

    const res = await request(app)
      .delete('/api/user')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // Verificamos que el usuario ya no existe en la BD
    const User = (await import('../src/models/User.js')).default
    const user = await User.findOne({ email: 'harddelete@test.com' })
    expect(user).toBeNull()
  })

  // Error: sin token no puede eliminar
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).delete('/api/user')

    expect(res.status).toBe(401)
  })
})

// ── POST /api/user/logout ────────────────────────────────────────────────────
describe('POST /api/user/logout', () => {
  // Caso feliz: cerrar sesión devuelve mensaje de éxito
  it('debe cerrar sesión correctamente', async () => {
    const { accessToken } = await registerUser('logout@test.com')

    const res = await request(app)
      .post('/api/user/logout')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')
  })

  // Error: sin token no puede hacer logout
  it('debe fallar con 401 si no hay token', async () => {
    const res = await request(app).post('/api/user/logout')

    expect(res.status).toBe(401)
  })
})

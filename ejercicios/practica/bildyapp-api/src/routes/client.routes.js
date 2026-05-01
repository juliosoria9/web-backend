// src/routes/client.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  getArchivedClients,
  restoreClient
} from '../controllers/client.controller.js'
import {
  createClientSchema,
  updateClientSchema
} from '../validators/client.validator.js'

const router = Router()

// Todas las rutas de clientes requieren autenticación
// IMPORTANTE: las rutas estáticas (/archived) van ANTES de las dinámicas (/:id)
// para que Express no interprete "archived" como un ObjectId

/**
 * @swagger
 * /client:
 *   post:
 *     summary: Crear un nuevo cliente para la compañía
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cif]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Empresa ABC S.L.
 *               cif:
 *                 type: string
 *                 example: B12345678
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   street: { type: string }
 *                   number: { type: string }
 *                   postal: { type: string }
 *                   city: { type: string }
 *                   province: { type: string }
 *     responses:
 *       201:
 *         description: Cliente creado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       409:
 *         description: Ya existe un cliente con ese CIF en la compañía
 */
router.post('/', auth, validate(createClientSchema), createClient)

/**
 * @swagger
 * /client:
 *   get:
 *     summary: Listar clientes activos de la compañía
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Resultados por página
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filtro por nombre (búsqueda parcial)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *         description: Campo de ordenación (prefijo - para descendente)
 *     responses:
 *       200:
 *         description: Lista de clientes con paginación
 *       401:
 *         description: No autorizado
 */
router.get('/', auth, getClients)

/**
 * @swagger
 * /client/archived:
 *   get:
 *     summary: Listar clientes archivados (borrado lógico) de la compañía
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filtro por nombre (búsqueda parcial)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Lista de clientes archivados con paginación
 *       401:
 *         description: No autorizado
 */
router.get('/archived', auth, getArchivedClients)

/**
 * @swagger
 * /client/{id}:
 *   get:
 *     summary: Obtener un cliente por ID
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del cliente (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Datos del cliente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente no encontrado
 */
router.get('/:id', auth, getClientById)

/**
 * @swagger
 * /client/{id}:
 *   put:
 *     summary: Actualizar los datos de un cliente
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               cif: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               address:
 *                 type: object
 *                 properties:
 *                   street: { type: string }
 *                   number: { type: string }
 *                   postal: { type: string }
 *                   city: { type: string }
 *                   province: { type: string }
 *     responses:
 *       200:
 *         description: Cliente actualizado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente no encontrado
 */
router.put('/:id', auth, validate(updateClientSchema), updateClient)

/**
 * @swagger
 * /client/{id}:
 *   delete:
 *     summary: Eliminar un cliente (soft o hard delete)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: soft
 *         schema: { type: boolean }
 *         description: Si es true, hace borrado lógico (archived); si es false o se omite, elimina definitivamente
 *     responses:
 *       200:
 *         description: Cliente eliminado o archivado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente no encontrado
 */
router.delete('/:id', auth, deleteClient)

/**
 * @swagger
 * /client/{id}/restore:
 *   patch:
 *     summary: Restaurar un cliente archivado
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del cliente archivado a restaurar
 *     responses:
 *       200:
 *         description: Cliente restaurado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente archivado no encontrado
 */
router.patch('/:id/restore', auth, restoreClient)

export default router

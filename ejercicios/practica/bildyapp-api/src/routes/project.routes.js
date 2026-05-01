// src/routes/project.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getArchivedProjects,
  restoreProject
} from '../controllers/project.controller.js'
import {
  createProjectSchema,
  updateProjectSchema
} from '../validators/project.validator.js'

const router = Router()

// Todas las rutas de proyectos requieren autenticación
// IMPORTANTE: las rutas estáticas (/archived) van ANTES de las dinámicas (/:id)
// para que Express no interprete "archived" como un ObjectId

/**
 * @swagger
 * /project:
 *   post:
 *     summary: Crear un nuevo proyecto para la compañía
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, projectCode, client]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Reforma oficina central
 *               projectCode:
 *                 type: string
 *                 example: PRJ-001
 *               client:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contacto@proyecto.com
 *               notes:
 *                 type: string
 *                 example: Proyecto urgente con entrega en 3 meses
 *               active:
 *                 type: boolean
 *                 example: true
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
 *         description: Proyecto creado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente no encontrado o no pertenece a la compañía
 *       409:
 *         description: Ya existe un proyecto con ese código en la compañía
 */
router.post('/', auth, validate(createProjectSchema), createProject)

/**
 * @swagger
 * /project:
 *   get:
 *     summary: Listar proyectos activos de la compañía
 *     tags: [Projects]
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
 *         description: Filtro por nombre (búsqueda parcial, sin distinción de mayúsculas)
 *       - in: query
 *         name: client
 *         schema: { type: string }
 *         description: Filtro por ID de cliente
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *         description: Filtro por estado activo/inactivo
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *         description: Campo de ordenación (prefijo - para descendente)
 *     responses:
 *       200:
 *         description: Lista de proyectos con paginación
 *       401:
 *         description: No autorizado
 */
router.get('/', auth, getProjects)

/**
 * @swagger
 * /project/archived:
 *   get:
 *     summary: Listar proyectos archivados (borrado lógico) de la compañía
 *     tags: [Projects]
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
 *         name: client
 *         schema: { type: string }
 *         description: Filtro por ID de cliente
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Lista de proyectos archivados con paginación
 *       401:
 *         description: No autorizado
 */
router.get('/archived', auth, getArchivedProjects)

/**
 * @swagger
 * /project/{id}:
 *   get:
 *     summary: Obtener un proyecto por ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del proyecto (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Datos del proyecto con cliente y usuario populados
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Proyecto no encontrado
 */
router.get('/:id', auth, getProjectById)

/**
 * @swagger
 * /project/{id}:
 *   put:
 *     summary: Actualizar los datos de un proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del proyecto (MongoDB ObjectId)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               projectCode: { type: string }
 *               client: { type: string }
 *               email: { type: string, format: email }
 *               notes: { type: string }
 *               active: { type: boolean }
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
 *         description: Proyecto actualizado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Proyecto o cliente no encontrado
 */
router.put('/:id', auth, validate(updateProjectSchema), updateProject)

/**
 * @swagger
 * /project/{id}:
 *   delete:
 *     summary: Eliminar un proyecto (soft o hard delete)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del proyecto (MongoDB ObjectId)
 *       - in: query
 *         name: soft
 *         schema: { type: boolean }
 *         description: Si es true, hace borrado lógico (archived); si se omite, elimina definitivamente
 *     responses:
 *       200:
 *         description: Proyecto eliminado o archivado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Proyecto no encontrado
 */
router.delete('/:id', auth, deleteProject)

/**
 * @swagger
 * /project/{id}/restore:
 *   patch:
 *     summary: Restaurar un proyecto archivado
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del proyecto archivado a restaurar
 *     responses:
 *       200:
 *         description: Proyecto restaurado correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Proyecto archivado no encontrado
 */
router.patch('/:id/restore', auth, restoreProject)

export default router

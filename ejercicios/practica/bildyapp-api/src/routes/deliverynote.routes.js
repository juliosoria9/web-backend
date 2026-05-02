// src/routes/deliverynote.routes.js
// Rutas del módulo de Albaranes (DeliveryNotes).
// IMPORTANTE: la ruta /pdf/:id va ANTES de /:id para que Express no
// intente interpretar la cadena "pdf" como un ObjectId de MongoDB.
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.js'
import { uploadSignature } from '../middleware/upload.js'
import {
  createDeliveryNote,
  getDeliveryNotes,
  getDeliveryNoteById,
  downloadPdf,
  signDeliveryNote,
  deleteDeliveryNote
} from '../controllers/deliverynote.controller.js'
import { createDeliveryNoteSchema } from '../validators/deliverynote.validator.js'

const router = Router()

// Todas las rutas requieren autenticación mediante JWT

/**
 * @swagger
 * tags:
 *   name: DeliveryNotes
 *   description: Gestión de albaranes (partes de trabajo)
 */

/**
 * @swagger
 * /deliverynote:
 *   post:
 *     summary: Crear un nuevo albarán
 *     tags: [DeliveryNotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [format, description, workDate, client, project]
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [material, hours]
 *                 example: hours
 *               description:
 *                 type: string
 *                 example: Instalación de fontanería en planta baja
 *               workDate:
 *                 type: string
 *                 format: date
 *                 example: '2025-06-15'
 *               client:
 *                 type: string
 *                 description: ObjectId del cliente
 *                 example: 6650a1b2c3d4e5f6a7b8c9d0
 *               project:
 *                 type: string
 *                 description: ObjectId del proyecto
 *                 example: 6650a1b2c3d4e5f6a7b8c9d1
 *               material:
 *                 type: string
 *                 example: Tubería PVC 50mm
 *               quantity:
 *                 type: number
 *                 example: 10
 *               unit:
 *                 type: string
 *                 example: metros
 *               hours:
 *                 type: number
 *                 example: 8
 *               workers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Juan García
 *                     hours:
 *                       type: number
 *                       example: 4
 *     responses:
 *       201:
 *         description: Albarán creado correctamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cliente o proyecto no encontrado en la compañía
 */
router.post('/', auth, validate(createDeliveryNoteSchema), createDeliveryNote)

/**
 * @swagger
 * /deliverynote:
 *   get:
 *     summary: Listar albaranes de la compañía con paginación y filtros
 *     tags: [DeliveryNotes]
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
 *         name: project
 *         schema: { type: string }
 *         description: Filtrar por ID de proyecto
 *       - in: query
 *         name: client
 *         schema: { type: string }
 *         description: Filtrar por ID de cliente
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [material, hours] }
 *         description: Filtrar por tipo de albarán
 *       - in: query
 *         name: signed
 *         schema: { type: boolean }
 *         description: Filtrar por estado de firma (true/false)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Fecha de inicio del rango (workDate >= from)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Fecha de fin del rango (workDate <= to)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -workDate }
 *         description: Campo de ordenación (prefijo - para descendente)
 *     responses:
 *       200:
 *         description: Lista de albaranes con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deliveryNotes:
 *                   type: array
 *                 totalItems:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: No autorizado
 */
router.get('/', auth, getDeliveryNotes)

/**
 * @swagger
 * /deliverynote/pdf/{id}:
 *   get:
 *     summary: Descargar o generar el PDF de un albarán
 *     description: |
 *       Si el albarán tiene ya un PDF guardado en Supabase, redirige a esa URL.
 *       Si no, genera el PDF al vuelo y lo devuelve como descarga directa.
 *     tags: [DeliveryNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del albarán (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Archivo PDF del albarán
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       302:
 *         description: Redirección a la URL del PDF en Supabase Storage
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Albarán no encontrado
 */
// IMPORTANTE: Esta ruta va ANTES de /:id para evitar que Express interprete
// la cadena "pdf" como un MongoDB ObjectId y lance un error de casteo.
router.get('/pdf/:id', auth, downloadPdf)

/**
 * @swagger
 * /deliverynote/{id}:
 *   get:
 *     summary: Obtener un albarán por ID
 *     tags: [DeliveryNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del albarán (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Datos completos del albarán con relaciones populadas
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Albarán no encontrado
 */
router.get('/:id', auth, getDeliveryNoteById)

/**
 * @swagger
 * /deliverynote/{id}/sign:
 *   patch:
 *     summary: Firmar un albarán subiendo una imagen de firma
 *     description: |
 *       Proceso de firma en varios pasos:
 *       1. Sube la imagen de firma a Supabase Storage (optimizada con Sharp a WebP).
 *       2. Genera el PDF del albarán firmado con pdfkit.
 *       3. Sube el PDF a Supabase Storage.
 *       4. Marca el albarán como firmado (irreversible).
 *       Un albarán firmado no puede modificarse ni eliminarse.
 *     tags: [DeliveryNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del albarán a firmar
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [signature]
 *             properties:
 *               signature:
 *                 type: string
 *                 format: binary
 *                 description: Imagen de la firma (JPEG, PNG o WebP, máx 5MB)
 *     responses:
 *       200:
 *         description: Albarán firmado correctamente con URL de firma y PDF generado
 *       400:
 *         description: El albarán ya está firmado o no se proporcionó imagen
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Albarán no encontrado
 */
router.patch('/:id/sign', auth, uploadSignature.single('signature'), signDeliveryNote)

/**
 * @swagger
 * /deliverynote/{id}:
 *   delete:
 *     summary: Eliminar un albarán (solo si no está firmado)
 *     description: |
 *       Realiza un hard delete (eliminación permanente) del albarán.
 *       No se puede eliminar un albarán que ya ha sido firmado.
 *     tags: [DeliveryNotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del albarán a eliminar
 *     responses:
 *       200:
 *         description: Albarán eliminado correctamente
 *       400:
 *         description: No se puede borrar un albarán firmado
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Albarán no encontrado
 */
router.delete('/:id', auth, deleteDeliveryNote)

export default router

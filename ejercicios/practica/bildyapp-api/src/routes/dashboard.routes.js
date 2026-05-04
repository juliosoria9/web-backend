// src/routes/dashboard.routes.js
import { Router } from 'express'
import { auth } from '../middleware/auth.middleware.js'
import { getDashboard } from '../controllers/dashboard.controller.js'

const router = Router()

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Estadísticas de la compañía (bonus)
 *     description: Devuelve un resumen con albaranes por mes, horas por proyecto y materiales por cliente usando aggregation pipeline de MongoDB.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas calculadas correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                   properties:
 *                     totalNotes: { type: integer }
 *                     totalSigned: { type: integer }
 *                     totalHours: { type: number }
 *                 notesByMonth:
 *                   type: array
 *                 hoursByProject:
 *                   type: array
 *                 materialsByClient:
 *                   type: array
 *       401:
 *         description: No autorizado
 */
router.get('/', auth, getDashboard)

export default router

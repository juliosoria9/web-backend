// src/controllers/dashboard.controller.js
// Bono: estadísticas con aggregation pipeline de MongoDB (T5)

import DeliveryNote from '../models/DeliveryNote.js'

// GET /api/dashboard
// Devuelve estadísticas de la compañía del usuario autenticado
export const getDashboard = async (req, res, next) => {
  try {
    const companyId = req.user.company

    // Ejecutamos todas las aggregations en paralelo para que sea más rápido
    const [notesByMonth, hoursByProject, materialsByClient, totals] = await Promise.all([

      // 1. Total de albaranes agrupados por mes
      DeliveryNote.aggregate([
        { $match: { company: companyId, deleted: false } },
        {
          $group: {
            _id: {
              year: { $year: '$workDate' },
              month: { $month: '$workDate' }
            },
            total: { $sum: 1 },
            signed: { $sum: { $cond: ['$signed', 1, 0] } }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 } // últimos 12 meses
      ]),

      // 2. Horas totales por proyecto (solo albaranes de tipo 'hours')
      DeliveryNote.aggregate([
        { $match: { company: companyId, deleted: false, format: 'hours' } },
        {
          $group: {
            _id: '$project',
            totalHours: { $sum: '$hours' },
            totalNotes: { $sum: 1 }
          }
        },
        // Traemos el nombre del proyecto con $lookup
        {
          $lookup: {
            from: 'projects',
            localField: '_id',
            foreignField: '_id',
            as: 'projectData'
          }
        },
        { $unwind: { path: '$projectData', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            projectName: '$projectData.name',
            projectCode: '$projectData.projectCode',
            totalHours: 1,
            totalNotes: 1
          }
        },
        { $sort: { totalHours: -1 } }
      ]),

      // 3. Materiales por cliente (solo albaranes de tipo 'material')
      DeliveryNote.aggregate([
        { $match: { company: companyId, deleted: false, format: 'material' } },
        {
          $group: {
            _id: '$client',
            totalQuantity: { $sum: '$quantity' },
            totalNotes: { $sum: 1 }
          }
        },
        // Traemos el nombre del cliente
        {
          $lookup: {
            from: 'clients',
            localField: '_id',
            foreignField: '_id',
            as: 'clientData'
          }
        },
        { $unwind: { path: '$clientData', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            clientName: '$clientData.name',
            clientCif: '$clientData.cif',
            totalQuantity: 1,
            totalNotes: 1
          }
        },
        { $sort: { totalNotes: -1 } }
      ]),

      // 4. Totales generales
      DeliveryNote.aggregate([
        { $match: { company: companyId, deleted: false } },
        {
          $group: {
            _id: null,
            totalNotes: { $sum: 1 },
            totalSigned: { $sum: { $cond: ['$signed', 1, 0] } },
            totalHours: { $sum: '$hours' }
          }
        }
      ])
    ])

    // Si no hay albaranes todavía, totals viene vacío — usamos valores a cero
    let totalesGenerales = { totalNotes: 0, totalSigned: 0, totalHours: 0 }
    if (totals.length > 0) {
      totalesGenerales = totals[0]
    }

    res.json({
      totals: totalesGenerales,
      notesByMonth,
      hoursByProject,
      materialsByClient
    })
  } catch (error) {
    next(error)
  }
}

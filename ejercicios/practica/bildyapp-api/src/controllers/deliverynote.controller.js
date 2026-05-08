// src/controllers/deliverynote.controller.js
// Controlador del módulo de Albaranes (DeliveryNotes).
// Un albarán registra un trabajo realizado (por material o por horas).
// Una vez firmado, no puede modificarse ni eliminarse.

import DeliveryNote from '../models/DeliveryNote.js'
import Client from '../models/Client.js'
import Project from '../models/Project.js'
import AppError from '../utils/AppError.js'
import { uploadImage, uploadPdf } from '../services/storage.service.js'
import { generateDeliveryNotePdf } from '../services/pdf.service.js'
import { config } from '../config/index.js'

// ── POST /api/deliverynote ────────────────────────────────────────────────────
// Crea un nuevo albarán para la compañía del usuario.
export const createDeliveryNote = async (req, res, next) => {
  try {
    // Sacamos los datos del cuerpo de la petición
    const {
      format,
      description,
      workDate,
      client,
      project,
      material,
      quantity,
      unit,
      hours,
      workers
    } = req.body

    // Comprobamos que el cliente existe y pertenece a la compañía del usuario
    const existingClient = await Client.findOne({
      _id: client,
      company: req.user.company,
      deleted: false
    })

    if (!existingClient) {
      return next(AppError.notFound('Cliente no encontrado o no pertenece a tu compañía'))
    }

    // Comprobamos que el proyecto existe y pertenece a la compañía del usuario
    const existingProject = await Project.findOne({
      _id: project,
      company: req.user.company,
      deleted: false
    })

    if (!existingProject) {
      return next(AppError.notFound('Proyecto no encontrado o no pertenece a tu compañía'))
    }

    // Creamos el nuevo albarán en la base de datos
    const newDeliveryNote = await DeliveryNote.create({
      user: req.user._id,
      company: req.user.company,
      client,
      project,
      format,
      description,
      workDate,
      // Estos campos son opcionales según el formato del albarán
      material,
      quantity,
      unit,
      hours,
      workers
    })

    // Avisamos por Socket.IO a los miembros de la compañía de que hay un albarán nuevo
    const companyRoom = `company:${req.user.company}`
    const io = req.app.locals.io
    if (io) {
      io.to(companyRoom).emit('deliverynote:new', newDeliveryNote)
    }

    res.status(201).json({ deliveryNote: newDeliveryNote })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/deliverynote ─────────────────────────────────────────────────────
// Lista los albaranes de la compañía con paginación, filtros y ordenación.
export const getDeliveryNotes = async (req, res, next) => {
  try {
    // Leemos los parámetros de paginación con valores por defecto seguros
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)
    const skip = (page - 1) * limit

    // Filtro base: solo albaranes de la compañía del usuario que no estén borrados
    const filter = {
      company: req.user.company,
      deleted: false
    }

    // Filtro opcional por proyecto
    if (req.query.project) {
      filter.project = req.query.project
    }

    // Filtro opcional por cliente
    if (req.query.client) {
      filter.client = req.query.client
    }

    // Filtro opcional por formato del albarán (solo aceptamos 'material' o 'hours')
    const validFormats = ['material', 'hours']
    if (req.query.format && validFormats.includes(req.query.format)) {
      filter.format = req.query.format
    }

    // Filtro opcional por estado de firma (convertimos el string a booleano)
    if (req.query.signed !== undefined) {
      filter.signed = req.query.signed === 'true'
    }

    // Filtro opcional por rango de fechas sobre workDate
    if (req.query.from || req.query.to) {
      filter.workDate = {}

      if (req.query.from) {
        filter.workDate.$gte = new Date(req.query.from)
      }

      if (req.query.to) {
        filter.workDate.$lte = new Date(req.query.to)
      }
    }

    // Ordenación: por defecto, los más recientes primero
    const sort = req.query.sort || '-workDate'

    // Lanzamos la búsqueda y el conteo en paralelo para que sea más rápido
    const [deliveryNotes, totalItems] = await Promise.all([
      DeliveryNote.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('client', 'name')
        .populate('project', 'name projectCode'),
      DeliveryNote.countDocuments(filter)
    ])

    // Calculamos el total de páginas
    const totalPages = Math.ceil(totalItems / limit)

    res.json({
      deliveryNotes,
      totalItems,
      totalPages,
      currentPage: page
    })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/deliverynote/:id ─────────────────────────────────────────────────
// Devuelve un albarán concreto con todos los datos relacionados.
export const getDeliveryNoteById = async (req, res, next) => {
  try {
    // Buscamos el albarán y populamos usuario, cliente y proyecto
    const deliveryNote = await DeliveryNote.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })
      .populate('user', 'name email')
      .populate('client', 'name cif email')
      .populate('project', 'name projectCode')

    if (!deliveryNote) {
      return next(AppError.notFound('Albarán no encontrado'))
    }

    res.json({ deliveryNote })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/deliverynote/pdf/:id ─────────────────────────────────────────────
// Descarga el PDF de un albarán (si existe en Supabase redirige, si no lo genera).
export const downloadPdf = async (req, res, next) => {
  try {
    // Buscamos el albarán con todos los datos necesarios para generar el PDF
    const deliveryNote = await DeliveryNote.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })
      .populate('user', 'name email')
      .populate('client', 'name cif email')
      .populate('project', 'name projectCode')

    if (!deliveryNote) {
      return next(AppError.notFound('Albarán no encontrado'))
    }

    // Si ya tenemos el PDF guardado en Supabase, redirigimos a esa URL
    if (deliveryNote.pdfUrl) {
      return res.redirect(deliveryNote.pdfUrl)
    }

    // Si no existe todavía, generamos el PDF al vuelo con pdfkit
    const pdfBuffer = await generateDeliveryNotePdf(deliveryNote)

    // Enviamos el PDF al navegador como descarga directa
    const fileName = `albaran-${deliveryNote._id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(pdfBuffer)
  } catch (error) {
    next(error)
  }
}

// ── PATCH /api/deliverynote/:id/sign ─────────────────────────────────────────
// Firma un albarán: sube la imagen de firma, genera el PDF y lo guarda en Supabase.
export const signDeliveryNote = async (req, res, next) => {
  try {
    const deliveryNote = await DeliveryNote.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })

    if (!deliveryNote) {
      return next(AppError.notFound('Albarán no encontrado'))
    }

    if (deliveryNote.signed) {
      return next(AppError.badRequest('El albarán ya está firmado'))
    }

    if (!req.file) {
      return next(AppError.badRequest('Se requiere imagen de firma'))
    }

    // Subimos la imagen de firma a Supabase (Sharp la optimiza a WebP por dentro)
    const signatureFileName = `signature-${deliveryNote._id}-${Date.now()}.webp`
    const signatureUrl = await uploadImage(
      req.file.buffer,
      signatureFileName,
      config.supabase.bucketSignatures
    )

    // Marcamos el albarán como firmado y guardamos la URL de la firma
    deliveryNote.signed = true
    deliveryNote.signedAt = new Date()
    deliveryNote.signatureUrl = signatureUrl
    await deliveryNote.save()

    // Populamos los datos antes de generar el PDF para que aparezca todo
    await deliveryNote.populate([
      { path: 'user', select: 'name email' },
      { path: 'client', select: 'name cif email' },
      { path: 'project', select: 'name projectCode' },
      { path: 'company', select: 'name cif' }
    ])

    const pdfBuffer = await generateDeliveryNotePdf(deliveryNote)

    // Subimos el PDF a Supabase y guardamos la URL
    const pdfFileName = `albaran-${deliveryNote._id}.pdf`
    const pdfUrl = await uploadPdf(
      pdfBuffer,
      pdfFileName,
      config.supabase.bucketPdfs
    )

    deliveryNote.pdfUrl = pdfUrl
    await deliveryNote.save()

    // Avisamos por Socket.IO a los miembros de la compañía de que se firmó el albarán
    const companyRoom = `company:${req.user.company}`
    const io = req.app.locals.io
    if (io) {
      io.to(companyRoom).emit('deliverynote:signed', deliveryNote)

      // Confirmación dirigida sólo al usuario firmante en su sala personal.
      // Payload mínimo: el cliente sabe qué albarán pasó a estado firmado y
      // tiene los datos justos para refrescar la UI sin volver a pedir el documento.
      const userRoom = `user:${req.user._id}`
      io.to(userRoom).emit('deliverynote:signed:ack', {
        deliveryNoteId: deliveryNote._id,
        signedAt: deliveryNote.signedAt,
        signatureUrl: deliveryNote.signatureUrl
      })
    }

    res.json({ deliveryNote })
  } catch (error) {
    next(error)
  }
}

// ── DELETE /api/deliverynote/:id ──────────────────────────────────────────────
// Elimina un albarán de forma permanente (no se permite si está firmado).
export const deleteDeliveryNote = async (req, res, next) => {
  try {
    // Buscamos el albarán comprobando que pertenece a la compañía del usuario
    const deliveryNote = await DeliveryNote.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })

    if (!deliveryNote) {
      return next(AppError.notFound('Albarán no encontrado'))
    }

    // Los albaranes firmados son inmutables: no se pueden borrar
    if (deliveryNote.signed) {
      return next(AppError.badRequest('No se puede borrar un albarán firmado'))
    }

    // Hard delete: eliminamos el documento por completo de la base de datos
    await DeliveryNote.findByIdAndDelete(deliveryNote._id)

    res.json({ message: 'Albarán eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

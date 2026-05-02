// src/models/DeliveryNote.js
import mongoose from 'mongoose'

// Cada trabajador tiene nombre y horas (se usa en albaranes de tipo 'hours')
const workerSchema = new mongoose.Schema({
  name: String,
  hours: Number
}, { _id: false })

const deliveryNoteSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  client:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

  // 'material' → se rellenan material/quantity/unit
  // 'hours'    → se rellenan hours/workers
  format: {
    type: String,
    enum: ['material', 'hours'],
    required: true
  },

  description: { type: String, required: true },
  workDate:    { type: Date, required: true },

  // Campos de albarán de material
  material: String,
  quantity: Number,
  unit: String,

  // Campos de albarán de horas
  hours: Number,
  workers: [workerSchema],

  // Firma: cuando signed es true el albarán ya no se puede editar ni borrar
  signed:       { type: Boolean, default: false },
  signedAt:     Date,
  signatureUrl: String,
  pdfUrl:       String,

  deleted: { type: Boolean, default: false }
}, {
  timestamps: true,
  versionKey: false
})

deliveryNoteSchema.index({ company: 1 })
deliveryNoteSchema.index({ project: 1 })
deliveryNoteSchema.index({ client: 1 })
deliveryNoteSchema.index({ signed: 1 })

export default mongoose.model('DeliveryNote', deliveryNoteSchema)

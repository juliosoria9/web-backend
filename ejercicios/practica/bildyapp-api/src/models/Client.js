// src/models/Client.js
import mongoose from 'mongoose'

// Subdocumento de dirección postal del cliente.
// Lo definimos sin _id porque va embebido dentro del cliente,
// no es un documento independiente.
const addressSchema = new mongoose.Schema({
  street: String,    // Nombre de la calle
  number: String,    // Número del portal
  postal: String,    // Código postal
  city: String,      // Ciudad
  province: String   // Provincia
}, { _id: false })

const clientSchema = new mongoose.Schema({
  // Usuario que creó este cliente (relación con User)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Compañía a la que pertenece el cliente (relación con Company)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Datos básicos del cliente
  name: { type: String, required: true, trim: true },   // Nombre o razón social del cliente
  cif: { type: String, required: true, trim: true },    // CIF/NIF identificador fiscal del cliente
  email: { type: String, trim: true, lowercase: true }, // Email de contacto (se guarda en minúsculas)
  phone: { type: String, trim: true },                  // Teléfono de contacto
  address: addressSchema,                               // Dirección postal (subdocumento)
  // Borrado lógico (soft delete): cuando es true, el cliente está "eliminado"
  // pero seguimos guardando el registro en la base de datos por si hay que recuperarlo.
  deleted: { type: Boolean, default: false }
}, {
  timestamps: true,   // Añade createdAt y updatedAt automáticamente
  versionKey: false   // Quita el campo __v que añade Mongoose por defecto
})

// Índice simple por compañía: acelera la búsqueda de "todos los clientes de una compañía",
// que es la consulta más habitual en este modelo.
clientSchema.index({ company: 1 })

// Índice único compuesto (cif + company):
// no puede haber dos clientes con el mismo CIF dentro de la misma compañía.
// Sí puede repetirse el CIF si pertenecen a compañías distintas.
clientSchema.index({ cif: 1, company: 1 }, { unique: true })

export default mongoose.model('Client', clientSchema)

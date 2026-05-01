// src/models/Project.js
import mongoose from 'mongoose'

// Subdocumento de dirección postal del proyecto.
// Sin _id porque va embebido dentro del proyecto,
// igual que en los demás modelos (Client, User, Company).
const addressSchema = new mongoose.Schema({
  street: String,    // Nombre de la calle
  number: String,    // Número del portal
  postal: String,    // Código postal
  city: String,      // Ciudad
  province: String   // Provincia
}, { _id: false })

const projectSchema = new mongoose.Schema({
  // Usuario que creó el proyecto (relación con User)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Compañía a la que pertenece el proyecto (relación con Company)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Cliente para el que se hace el proyecto (relación con Client)
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  // Datos básicos del proyecto
  name: { type: String, required: true, trim: true },         // Nombre del proyecto
  projectCode: { type: String, required: true, trim: true },  // Código interno del proyecto (ej: "PRJ-001")
  address: addressSchema,                                     // Dirección donde se realiza el trabajo
  email: { type: String, trim: true, lowercase: true },       // Email de contacto del proyecto
  notes: String,                                              // Notas u observaciones libres
  // Estado del proyecto: true si está en curso, false si está pausado o terminado
  active: { type: Boolean, default: true },
  // Borrado lógico (soft delete): no se elimina de la BD, solo se marca como deleted
  deleted: { type: Boolean, default: false }
}, {
  timestamps: true,   // Añade createdAt y updatedAt automáticamente
  versionKey: false   // Quita el campo __v de Mongoose
})

// Índice por compañía: acelera "listar todos los proyectos de una compañía",
// que es la consulta principal del listado.
projectSchema.index({ company: 1 })

// Índice por cliente: acelera "listar proyectos de un cliente concreto",
// muy útil al entrar a la ficha de un cliente.
projectSchema.index({ client: 1 })

// Índice único compuesto (projectCode + company):
// no puede haber dos proyectos con el mismo código dentro de la misma compañía.
// Otra compañía sí podría usar el mismo código sin conflicto.
projectSchema.index({ projectCode: 1, company: 1 }, { unique: true })

export default mongoose.model('Project', projectSchema)

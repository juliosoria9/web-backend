// src/middleware/upload.js
import multer from 'multer'
import path from 'path'

// ── Configuración para subir el logo al disco local ──────────────────────────
// El logo de la compañía se guarda en la carpeta uploads/ con un nombre único.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  cb(null, allowedTypes.includes(file.mimetype))
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
})

// ── Configuración para la firma del albarán (en memoria) ─────────────────────
// Usamos memoryStorage porque necesitamos el buffer para procesarlo con Sharp
// antes de subirlo a Supabase Storage. No guardamos nada en disco.
const memoryStorage = multer.memoryStorage()

export const uploadSignature = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    // Solo aceptamos imágenes (jpeg, png, webp...)
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan imágenes'))
    }
  }
})

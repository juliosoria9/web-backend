// src/services/storage.service.js
// Sube imágenes y PDFs a Supabase Storage
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { config } from '../config/index.js'

// Cliente de Supabase con la service key (tiene permisos para subir archivos)
const supabase = createClient(config.supabase.url, config.supabase.serviceKey)

// Sube una imagen al bucket después de optimizarla con Sharp
// La convierte a WebP y la reduce a 800px para que pese menos
// Devuelve la URL pública del archivo subido
export const uploadImage = async (buffer, filename, bucket) => {
  const optimizedImage = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filename, optimizedImage, { contentType: 'image/webp', upsert: true })

  if (uploadError) {
    throw new Error(`Error subiendo imagen a Supabase: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}

// Sube un PDF al bucket tal cual (ya viene comprimido de pdfkit)
// Devuelve la URL pública del archivo subido
export const uploadPdf = async (buffer, filename, bucket) => {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    throw new Error(`Error subiendo PDF a Supabase: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}

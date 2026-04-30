// src/config/index.js
// Centraliza todas las variables de entorno de la aplicación.
// La función dbConnect se movió a config/database.js.

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUri: process.env.DB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  // Configuración de Supabase Storage para firmas y PDFs
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    bucketSignatures: process.env.SUPABASE_BUCKET_SIGNATURES || 'signatures',
    bucketPdfs: process.env.SUPABASE_BUCKET_PDFS || 'pdfs'
  },
  // Resend: servicio de envío de emails transaccionales
  resend: {
    apiKey: process.env.RESEND_API_KEY
  },
  // Slack Webhook para alertas de errores 5XX (opcional)
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  },
  // Email remitente por defecto para los correos de la app
  fromEmail: process.env.FROM_EMAIL || 'noreply@bildyapp.com'
}

// En tests usamos mongodb-memory-server, así que no validamos DB_URI
if (process.env.NODE_ENV !== 'test') {
  if (!config.dbUri) {
    console.error('DB_URI no está definida en las variables de entorno')
    process.exit(1)
  }
  if (!config.jwt.secret) {
    console.error('JWT_SECRET no está definida en las variables de entorno')
    process.exit(1)
  }
  if (!config.jwt.refreshSecret) {
    console.error('JWT_REFRESH_SECRET no está definida en las variables de entorno')
    process.exit(1)
  }
}

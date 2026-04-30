// src/services/mail.service.js
// Servicio de envío de emails usando Resend (https://resend.com).
// Resend es una plataforma moderna que simplifica el envío de emails transaccionales.
import { Resend } from 'resend'
import { config } from '../config/index.js'

// Inicializamos el cliente de Resend con la API key del .env
const resend = new Resend(config.resend.apiKey)

// Envía el código de verificación de 6 dígitos al email del usuario.
// El código se genera antes de llamar a esta función y se pasa como parámetro.
export const sendVerificationEmail = async (email, code) => {
  // Si no hay API key configurada, solo mostramos el código en consola (útil en desarrollo)
  if (!config.resend.apiKey) {
    console.log(`[MAIL] Código de verificación para ${email}: ${code}`)
    return
  }

  try {
    await resend.emails.send({
      from: config.fromEmail,
      to: email,
      subject: 'Verifica tu cuenta en BildyApp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">¡Bienvenido a BildyApp!</h2>
          <p>Tu código de verificación es:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
            <h1 style="color: #4F46E5; letter-spacing: 8px; font-size: 32px;">${code}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Este código caduca en 24 horas.</p>
        </div>
      `
    })
  } catch (error) {
    // Logueamos el error pero no lo lanzamos para no bloquear el registro del usuario
    console.error('[MAIL] Error enviando email de verificación:', error.message)
  }
}

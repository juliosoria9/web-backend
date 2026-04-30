// src/services/notification.service.js
// Servicio de notificaciones con EventEmitter
// Los controladores emiten eventos y aquí los procesamos (logs, Slack, etc.)
import { EventEmitter } from 'events'
import { IncomingWebhook } from '@slack/webhook'
import { config } from '../config/index.js'

class NotificationService extends EventEmitter {}

const notificationService = new NotificationService()

notificationService.on('user:registered', (data) => {
  const email = data && data.email ? data.email : 'unknown'
  console.log(`[EVENT] user:registered:${email}`)
})

notificationService.on('user:verified', (data) => {
  const email = data && data.email ? data.email : 'unknown'
  console.log(`[EVENT] user:verified:${email}`)
})

notificationService.on('user:invited', (data) => {
  const email = data && data.email ? data.email : 'unknown'
  console.log(`[EVENT] user:invited:${email}`)
})

notificationService.on('user:deleted', (data) => {
  const email = data && data.email ? data.email : 'unknown'
  console.log(`[EVENT] user:deleted:${email}`)
})

export default notificationService

// Manda un aviso a Slack cuando hay un error 500
// Si no hay SLACK_WEBHOOK_URL en el .env, no hace nada
export const notifySlackError = async (req, err) => {
  if (!config.slack.webhookUrl) return

  try {
    const webhook = new IncomingWebhook(config.slack.webhookUrl)

    const ruta = `${req.method} ${req.originalUrl}`
    const mensaje = `*Ruta:* ${ruta}\n*Error:* ${err.message}\n*Hora:* ${new Date().toISOString()}`

    await webhook.send({
      text: '🚨 *Error 5XX en BildyApp*',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: mensaje }
        }
      ]
    })
  } catch (slackError) {
    console.error('[SLACK] Error enviando notificación:', slackError.message)
  }
}

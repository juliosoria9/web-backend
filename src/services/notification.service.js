// src/services/notification.service.js
import { EventEmitter } from 'events'

class NotificationService extends EventEmitter {}

const notificationService = new NotificationService()

notificationService.on('user:registered', (data) => {
  console.log(`[EVENT] user:registered:${data?.email ?? 'unknown'}`)
})

notificationService.on('user:verified', (data) => {
  console.log(`[EVENT] user:verified:${data?.email ?? 'unknown'}`)
})

notificationService.on('user:invited', (data) => {
  console.log(`[EVENT] user:invited:${data?.email ?? 'unknown'}`)
})

notificationService.on('user:deleted', (data) => {
  console.log(`[EVENT] user:deleted:${data?.email ?? 'unknown'}`)
})

export default notificationService

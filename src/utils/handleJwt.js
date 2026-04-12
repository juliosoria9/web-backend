// src/utils/handleJwt.js
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

export const tokenSign = (user) => {
  return jwt.sign(
    { _id: user._id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

export const tokenSignRefresh = (user) => {
  return jwt.sign(
    { _id: user._id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
}

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret)
  } catch {
    return null
  }
}

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret)
  } catch {
    return null
  }
}

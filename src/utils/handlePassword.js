// src/utils/handlePassword.js
import bcrypt from 'bcryptjs'

export const encrypt = async (password) => {
  return bcrypt.hash(password, 10)
}

export const compare = async (plain, hash) => {
  return bcrypt.compare(plain, hash)
}

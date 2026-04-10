// src/middleware/validate.js
import { ZodError } from 'zod'

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    })
    // Apply transformed values back (e.g. email toLowerCase)
    if (parsed.body) req.body = parsed.body
    if (parsed.query) req.query = parsed.query
    if (parsed.params) req.params = parsed.params
    next()
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: true,
        message: 'Error de validación',
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      })
    }
    next(error)
  }
}

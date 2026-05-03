// src/config/swagger.js
// Configura swagger-jsdoc y swagger-ui-express para generar la documentación
// interactiva de la API en la ruta /api-docs.
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

// Opciones de configuración de Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BildyApp API',
      version: '2.0.0',
      description: 'API REST para gestión de albaranes entre clientes y proveedores'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Servidor de desarrollo' }
    ],
    components: {
      securitySchemes: {
        // Autenticación mediante JWT en la cabecera Authorization: Bearer <token>
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  // Escanea todos los archivos de rutas para encontrar las anotaciones JSDoc
  apis: ['./src/routes/*.js']
}

export const swaggerSpec = swaggerJsdoc(swaggerOptions)
export { swaggerUi }

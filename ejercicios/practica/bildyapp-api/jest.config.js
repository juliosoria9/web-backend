// Configuración de Jest para proyectos con ES Modules
export default {
  testEnvironment: 'node',
  // Para ES Modules, Jest no transforma los archivos
  transform: {},
  // Nota: extensionsToTreatAsEsm ya no es necesario porque package.json tiene "type": "module"
  // Resolvemos imports sin extensión
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  // Carga las variables de entorno de test antes que cualquier módulo
  setupFiles: ['<rootDir>/tests/env.setup.cjs'],
  // Dónde están los tests
  testMatch: ['**/tests/**/*.test.js'],
  // Configuración para la cobertura
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',                          // entry point — no es lógica de negocio
    '!src/services/storage.service.js',       // requiere credenciales reales de Supabase
    '!src/middleware/socket-auth.js'           // requiere conexión WebSocket real
  ]
}

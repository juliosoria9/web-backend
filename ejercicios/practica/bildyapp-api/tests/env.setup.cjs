// Variables de entorno para el entorno de tests
// Este archivo se ejecuta antes que cualquier test (setupFiles en jest.config.js)
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_enough_for_tests'
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_long_for_tests'
process.env.JWT_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'
// Clave dummy para Resend: el SDK lanza error si no hay API key al importar el módulo.
// En tests el servicio de mail ya maneja el caso de clave ausente/inválida sin bloquear.
process.env.RESEND_API_KEY = 're_test_dummy_key_for_jest'
// Valores dummy para Supabase (no se usan en tests porque el endpoint de firma se omite)
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test_supabase_service_key_dummy'

# BildyApp API

API REST completa para gestión de albaranes — práctica final del curso Web II.

Permite registrar usuarios, gestionar empresas, clientes, proyectos y albaranes digitales con firma, generación de PDF y subida a la nube.

## Requisitos

- Node.js 22+
- Cuenta MongoDB Atlas (o MongoDB local)
- Cuenta Supabase (para almacenamiento de firmas y PDFs)
- Cuenta Resend (para envío de emails de verificación)

## Instalación

```bash
npm install
```

Copia `.env.example` a `.env` y rellena las variables:

```bash
cp .env.example .env
```

Ver [.env.example](.env.example) para descripción de cada variable.

## Ejecución

```bash
# Desarrollo (con --watch, recarga automática)
npm run dev

# Producción
npm start
```

La API arranca en `http://localhost:3000` por defecto.

## Tests

```bash
# Ejecutar todos los tests
npm test

# Modo watch (re-ejecuta al guardar)
npm run test:watch

# Con informe de cobertura
npm run test:coverage
```

Los tests usan **mongodb-memory-server**: arrancan un MongoDB temporal en memoria, no necesitan conexión externa.

## Docker

```bash
# Levantar la app + MongoDB con Docker Compose
docker compose up

# En segundo plano
docker compose up -d

# Parar y eliminar contenedores
docker compose down
```

El compose levanta dos servicios: `app` (Node.js en puerto 3000) y `mongo` (MongoDB en puerto 27017). Los datos de Mongo persisten en el volumen `mongo_data`.

## Endpoints

### Usuarios y autenticación

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|:----:|:---:|-------------|
| GET | `/health` | — | — | Health check |
| POST | `/api/user/register` | — | — | Registro + tokens JWT |
| POST | `/api/user/login` | — | — | Login |
| POST | `/api/user/refresh` | — | — | Renovar access token |
| PUT | `/api/user/validation` | JWT | — | Verificar email (código 6 dígitos) |
| PUT | `/api/user/register` | JWT | — | Onboarding: datos personales |
| PUT | `/api/user/password` | JWT | — | Cambiar contraseña |
| PATCH | `/api/user/company` | JWT | — | Onboarding: empresa |
| PATCH | `/api/user/logo` | JWT | — | Subir logo de empresa |
| GET | `/api/user` | JWT | — | Obtener perfil con empresa |
| POST | `/api/user/logout` | JWT | — | Cerrar sesión |
| POST | `/api/user/invite` | JWT | admin | Invitar colega a la empresa |
| DELETE | `/api/user` | JWT | — | Eliminar cuenta (`?soft=true` para borrado lógico) |

Usa el fichero `api.http` con la extensión **REST Client** de VS Code para probar todos los endpoints.

## Estructura del proyecto

```
bildyapp-api/
├── src/
│   ├── index.js              # Entry point — arranca el servidor
│   ├── app.js                # Express: middleware y rutas
│   ├── config/
│   │   └── index.js          # Variables de entorno y conexión a MongoDB
│   ├── models/               # Esquemas Mongoose
│   │   ├── User.js
│   │   ├── Company.js
│   │   ├── Client.js
│   │   ├── Project.js
│   │   └── DeliveryNote.js
│   ├── routes/               # Definición de rutas Express
│   │   └── user.routes.js
│   ├── controllers/          # Lógica de negocio por recurso
│   │   └── user.controller.js
│   ├── middleware/           # Middlewares reutilizables
│   │   ├── auth.middleware.js     # Verificación JWT
│   │   ├── role.middleware.js     # Control de roles
│   │   ├── validate.js           # Validación Zod
│   │   ├── upload.js             # Multer (subida de archivos)
│   │   └── error-handler.js      # Manejo centralizado de errores
│   ├── services/             # Servicios externos
│   │   ├── mail.service.js       # Envío de emails con Resend
│   │   ├── storage.service.js    # Subida de archivos a Supabase
│   │   └── notification.service.js  # Notificaciones Slack
│   ├── validators/           # Esquemas de validación Zod
│   └── utils/                # Utilidades varias
├── tests/
│   └── setup.js              # Helper: conectar/limpiar DB en tests
├── docs/                     # Documentación Swagger
├── uploads/                  # Archivos subidos localmente
├── .env.example              # Plantilla de variables de entorno
├── jest.config.js            # Configuración de Jest (ESM)
├── Dockerfile                # Build multi-stage para producción
├── docker-compose.yml        # App + MongoDB para desarrollo/producción
└── .github/
    └── workflows/
        └── test.yml          # CI: ejecuta tests en cada push
```

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 22+ con ESM (`type: module`) |
| Framework | Express 5 |
| Base de datos | MongoDB Atlas + Mongoose 8 |
| Validación | Zod (con `.transform()` y `.refine()`) |
| Autenticación | JWT (access 15min + refresh 7 días) + bcryptjs |
| Seguridad | Helmet, express-rate-limit, express-mongo-sanitize |
| Subida de archivos | Multer + Supabase Storage |
| Emails | Resend |
| Notificaciones | Slack Webhooks |
| Tests | Jest 29 + Supertest + mongodb-memory-server |
| Contenedores | Docker + Docker Compose |
| CI/CD | GitHub Actions |

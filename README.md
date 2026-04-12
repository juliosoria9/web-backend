# BildyApp API

API REST para gestión de usuarios de BildyApp — práctica intermedia del curso Web II.

## Requisitos

- Node.js 22+
- Cuenta MongoDB Atlas

## Instalación

```bash
npm install
```

Copiar `.env.example` a `.env` y rellenar las variables:

```bash
cp .env.example .env
```

## Ejecución

```bash
# Desarrollo (con --watch)
npm run dev

# Producción
npm start
```

## Endpoints

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/health` | ❌ | — | Health check |
| POST | `/api/user/register` | ❌ | — | Registro + tokens JWT |
| POST | `/api/user/login` | ❌ | — | Login |
| POST | `/api/user/refresh` | ❌ | — | Renovar access token |
| PUT | `/api/user/validation` | ✅ | — | Verificar email (código 6 dígitos) |
| PUT | `/api/user/register` | ✅ | — | Onboarding: datos personales |
| PUT | `/api/user/password` | ✅ | — | Cambiar contraseña |
| PATCH | `/api/user/company` | ✅ | — | Onboarding: empresa |
| PATCH | `/api/user/logo` | ✅ | — | Subir logo de empresa |
| GET | `/api/user` | ✅ | — | Obtener perfil con empresa |
| POST | `/api/user/logout` | ✅ | — | Cerrar sesión |
| POST | `/api/user/invite` | ✅ | admin | Invitar colega a la empresa |
| DELETE | `/api/user` | ✅ | — | Eliminar cuenta (`?soft=true` para borrado lógico) |

Usa el fichero `api.http` con la extensión **REST Client** de VS Code para probar todos los endpoints.

## Variables de entorno

Ver `.env.example` para las variables requeridas.

## Stack técnico

- **Runtime**: Node.js 22+ con ESM (`type: module`)
- **Framework**: Express 5
- **Base de datos**: MongoDB Atlas + Mongoose
- **Validación**: Zod (con `.transform()` y `.refine()`)
- **Autenticación**: JWT (access 15min + refresh 7 días) + bcryptjs
- **Seguridad**: Helmet, express-rate-limit, express-mongo-sanitize
- **Subida de archivos**: Multer (imágenes, máx. 5MB)
- **Eventos**: Node.js EventEmitter

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

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | ❌ | Health check |
| POST | `/api/user/register` | ❌ | Registro |
| PUT | `/api/user/validation` | ✅ | Verificar email |
| POST | `/api/user/login` | ❌ | Login |
| PUT | `/api/user/register` | ✅ | Onboarding personal |
| PATCH | `/api/user/company` | ✅ | Onboarding empresa |
| PATCH | `/api/user/logo` | ✅ | Subir logo |
| GET | `/api/user` | ✅ | Obtener usuario |

Usa el fichero `api.http` con la extensión REST Client de VS Code para probar los endpoints.

## Variables de entorno

Ver `.env.example` para las variables requeridas.

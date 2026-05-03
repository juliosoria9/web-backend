# ── Etapa 1: instalar dependencias de producción ──────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copiamos solo package.json para aprovechar el cache de capas de Docker
COPY package*.json ./
RUN npm ci --only=production

# ── Etapa 2: imagen de producción final ───────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Copiamos las dependencias de la etapa anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiamos el código fuente
COPY src ./src

# Puerto que expone la app
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/index.js"]

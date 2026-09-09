# syntax=docker/dockerfile:1
#
# Imagen de produccion para el backend de InConexion Platform.
#
# IMPORTANTE: el contexto de build debe ser la RAIZ del repo (no server/),
# porque la imagen necesita tanto server/ como public/. Construir con:
#
#   docker build -f server/Dockerfile -t inconexion .
#
# docker-compose.yml ya lo hace asi.

# ── Etapa 1: dependencias ───────────────────────────────────
# node:20 (imagen completa) trae las herramientas de compilacion por si
# better-sqlite3 necesitara compilar el binario nativo.
FROM node:20-bookworm AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Etapa 2: runtime ────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
# curl para el HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# node_modules ya compilado contra el mismo ABI de Node 20
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY public/ ./public/

# Carpeta de datos propiedad del usuario no root (el volumen se monta aqui)
RUN mkdir -p /app/server/data && chown -R node:node /app
USER node

WORKDIR /app/server
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-3000}/api/health || exit 1

# bootstrap.js hidrata los secretos desde AWS SSM (si SSM_PARAM_PREFIX esta
# definido) y luego arranca server.js. Sin SSM_PARAM_PREFIX se comporta igual.
CMD ["node", "bootstrap.js"]

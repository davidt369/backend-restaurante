# ============================================================
# Dockerfile — Entorno de DESARROLLO con Hot-Reload
#
# Stack: Node 22 LTS (Alpine) + NestJS Development
# Database: PostgreSQL 17 (levantada vía docker-compose)
# ============================================================

FROM node:22-alpine

WORKDIR /usr/src/app

# Instalar dependencias del sistema necesarias
# - python3, make, g++  → compilar módulos nativos (bcrypt, pg, etc)
# - bash                → ejecutar entrypoint.sh
# - postgresql-client   → pg_isready para esperar a PostgreSQL
# - inotify-tools       → mejor detección de cambios en volúmenes
RUN apk add --no-cache python3 make g++ bash postgresql-client inotify-tools

# ⏰ IMPORTANTE: Habilitar polling para detectar cambios en volúmenes montados
# Esto es crítico para el hot-reload en desarrollo
ENV WATCHPACK_POLLING=true
ENV WEBPACK_WATCH_POLL=true

# Copiar manifests (package.json, package-lock.json)
# Esto optimiza la caché de Docker (layer caching)
COPY package.json package-lock.json* ./

# Instalar todas las dependencias (dev incluidas — necesarias para @nestjs/cli)
RUN if [ -f package-lock.json ]; then \
			echo "package-lock.json found — running npm ci" && npm ci --prefer-offline --no-audit; \
		else \
			echo "package-lock.json not found — running npm install" && npm install --prefer-offline --no-audit; \
		fi

# Copiar el resto del código fuente
COPY . .

# Asegurar que el entrypoint exista con finales de línea UNIX y permisos de ejecución
COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN sed -i 's/\r$//' /usr/src/app/entrypoint.sh && chmod +x /usr/src/app/entrypoint.sh || true

# Puerto donde corre la API
EXPOSE 3000

# Entrypoint: espera a PostgreSQL, corre migraciones y levanta el servidor
ENTRYPOINT ["/bin/bash", "/usr/src/app/entrypoint.sh"]

#!/bin/bash
# ============================================================
# entrypoint.sh — Script de inicio del contenedor NestJS
#
# Secuencia:
#   1. Esperar a que PostgreSQL esté disponible (pg_isready)
#   2. Ejecutar migraciones (drizzle-kit migrate)
#   3. Ejecutar seeders (tsx src/db/scripts/seed.ts)
#   4. Iniciar el servidor en modo desarrollo (npm run start:dev)
# ============================================================

set -e  # Salir inmediatamente si algún comando falla

# ── Colores para los logs ──────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

log_info()    { echo -e "${CYAN}[entrypoint]${NC} $1"; }
log_success() { echo -e "${GREEN}[entrypoint] ✔ $1${NC}"; }
log_warning() { echo -e "${YELLOW}[entrypoint] ⚠ $1${NC}"; }
log_error()   { echo -e "${RED}[entrypoint] ✘ $1${NC}"; }

# ── 1. Esperar a PostgreSQL ────────────────────────────────
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-restaurante_user}"
DB_NAME="${DB_NAME:-restaurante_db}"

MAX_RETRIES=30
RETRY_INTERVAL=2
attempt=1

log_info "Esperando a PostgreSQL en $DB_HOST:$DB_PORT..."

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q; do
  if [ $attempt -ge $MAX_RETRIES ]; then
    log_error "PostgreSQL no respondió después de $((MAX_RETRIES * RETRY_INTERVAL)) segundos. Abortando."
    exit 1
  fi
  log_warning "Intento $attempt/$MAX_RETRIES — PostgreSQL aún no está listo. Reintentando en ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
  attempt=$((attempt + 1))
done

log_success "PostgreSQL está disponible."

# ── 2. Ejecutar Drizzle Push (sincronizar schema) ────────────────────────────────
log_info "Sincronizando schema con drizzle-kit push..."
npx --version >/dev/null 2>&1 || true

# ── Instalación automática de dependencias si faltan (desarrollo)
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  log_warning "node_modules no encontrado o vacío — instalando dependencias con npm ci..."
  npm ci --prefer-offline --no-audit || {
    log_error "npm ci falló"
    exit 1
  }
  log_success "Dependencias instaladas"
fi

npx drizzle-kit push || {
  log_error "drizzle-kit push falló"
  exit 1
}
log_success "Schema sincronizado"
log_success "Schema sincronizado"

# ── 3. Ejecutar seeders (si existen) ───────────────────────
if [ -f src/db/scripts/seed.ts ]; then
  log_info "Ejecutando seeders..."
  npx tsx src/db/scripts/seed.ts || {
    log_error "Seeders fallaron"
    exit 1
  }
  log_success "Seeders completados"
else
  log_warning "No se encontraron seeders"
fi

# ── 4. Iniciar servidor en modo desarrollo ─────────────────
log_info "Iniciando NestJS (start:dev)..."

# Ejecutar el proceso principal (mantiene el contenedor vivo)
exec npm run start:dev

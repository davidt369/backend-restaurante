#!/bin/bash
# ============================================================
# setup.sh — Script de Setup para Linux/Mac
#
# Uso: bash setup.sh  o  ./setup.sh
#
# Este script automáticamente:
#   1. Copia .env.example a .env (si no existe)
#   2. Levanta docker-compose con PostgreSQL + API
#   3. Espera a que la DB esté lista
#   4. Ejecuta migraciones y seeders automáticamente
#   5. El API estará disponible en http://localhost:3000
#
# Apagar: Ctrl+C
# ============================================================

set -e  # Exit si algo falla

# ── Colores para los logs ──────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[setup]${NC} $1"; }
log_success() { echo -e "${GREEN}[setup] ✔ $1${NC}"; }
log_warning() { echo -e "${YELLOW}[setup] ⚠ $1${NC}"; }
log_error()   { echo -e "${RED}[setup] ✘ $1${NC}"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 1: Verificar Docker
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_info "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    log_error "Docker no está instalado"
    log_warning "Por favor instala Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi
log_success "Docker está instalado"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 2: Crear .env si no existe
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_info "Configurando archivo .env..."
if [ -f ".env" ]; then
    log_success ".env ya existe"
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success ".env creado desde .env.example"
    else
        log_error ".env.example no encontrado"
        exit 1
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 3: Levantar Docker Compose
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_info "Levantando Docker Compose (PostgreSQL + API)..."
log_warning "Esta es la primera ejecución — puede tomar algunos minutos mientras baja imágenes y compila"
log_info ""
log_info "╔════════════════════════════════════════════════════════════════╗"
log_info "║  Una vez que el servidor esté listo, verás este mensaje:      ║"
log_info "║  'SERVER RUNNING SUCCESSFULLY'                                ║"
log_info "║                                                                ║"
log_info "║  API disponible en: http://localhost:3000                      ║"
log_info "║  Swagger en: http://localhost:3000/api                         ║"
log_info "║                                                                ║"
log_info "║  Para detener: Presiona Ctrl+C                                 ║"
log_info "╚════════════════════════════════════════════════════════════════╝"
log_info ""

# Hacer trap para capturar Ctrl+C y limpiar
trap 'log_warning "Setup interrumpido. Contenedores siguen corriendo."; exit 0' INT

docker compose up --build

# Si llegas aquí, significa que Ctrl+C fue presionado o hubo un error
log_warning "Setup finalizado o interrumpido"

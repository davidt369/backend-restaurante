# ============================================================
# setup.ps1 — Script de Setup para Windows
#
# Uso: .\setup.ps1
#
# Este script automáticamente:
#   1. Copia .env.example a .env (si no existe)
#   2. Levanta docker-compose con PostgreSQL + API
#   3. Espera a que la DB esté lista
#   4. Ejecuta migraciones y seeders automáticamente
#   5. El API estará disponible en http://localhost:3000
#
# Apagar: Ctrl+C (Stop-Process)
# ============================================================

# Estilos de color
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$CYAN = "`e[36m"
$RED = "`e[31m"
$NC = "`e[0m"

function Write-Info { Write-Host "${CYAN}[setup]${NC} $args" }
function Write-Success { Write-Host "${GREEN}[setup] ✔ $args${NC}" }
function Write-Warning { Write-Host "${YELLOW}[setup] ⚠ $args${NC}" }
function Write-Error-Custom { Write-Host "${RED}[setup] ✘ $args${NC}" }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 1: Verificar Docker
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write-Info "Verificando Docker..."
try {
    $null = docker --version
    Write-Success "Docker está instalado"
} catch {
    Write-Error-Custom "Docker no está instalado o no está en el PATH"
    Write-Warning "Por favor instala Docker: https://www.docker.com/products/docker-desktop"
    exit 1
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 2: Crear .env si no existe
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write-Info "Configurando archivo .env..."
if (Test-Path ".env") {
    Write-Success ".env ya existe"
} else {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Success ".env creado desde .env.example"
    } else {
        Write-Error-Custom ".env.example no encontrado"
        exit 1
    }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PASO 3: Levantar Docker Compose
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write-Info "Levantando Docker Compose (PostgreSQL + API)..."
Write-Warning "Esta es la primera ejecución — puede tomar algunos minutos mientras baja imágenes y compila"

try {
    # Usar & para ejecutar en el mismo proceso (mantiene Ctrl+C funcionando)
    & docker compose up --build 2>&1
}
catch {
    Write-Error-Custom "Error levantando docker compose: $_"
    exit 1
}

# Si llegas aquí, significa que Ctrl+C fue presionado o hubo un error
Write-Warning "Setup finalizado o interrumpido"

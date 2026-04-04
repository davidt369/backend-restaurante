# PRD — Backend (Restaurante V2)

> Versión: 1.0
> Fecha: 31 de marzo de 2026
> Área: API / Persistencia / Integraciones

## Resumen ejecutivo

Este documento define los requisitos, contratos API, modelos de datos, migraciones, criterios de aceptación y un conjunto completo de casos de prueba listos para que TestSprite ejecute pruebas automáticas sobre el backend del proyecto "Restaurante V2".

Objetivo: entregar una API REST (con opcional complementos GraphQL/WebSocket) robusta, segura y testeable para los módulos: `auth`, `caja`, `transacciones`, `productos`, `ingredientes`, `usuarios`, `dashboard` y módulos auxiliares.

## Alcance

Incluye implementación y pruebas automáticas para:
- Autenticación y autorización (roles: `admin`, `cajero`, `cocina`).
- Gestión de caja (abrir, estado, cerrar, resumen de turno).
- Transacciones / Ventas (crear, listar, detalle, reembolso parcial/completo).
- Productos e ingredientes (CRUD, stock básico para ventas).
- Usuarios (CRUD, roles, estado activo/inactivo).
- Dashboard / métricas (endpoints de resumen para UI).
- Integridad transaccional y manejo de concurrencia en el registro de ventas.

No incluye: integración con pasarelas de pago externas avanzadas (se aceptan campos de pago simulados y `reciboUrl`), ni integración física con impresoras TPV (se documenta interfaz).

## Stakeholders

- Product Owner
- Equipo Backend
- Equipo Frontend
- QA / TestSprite
- DevOps

## Requisitos funcionales (detallados por módulo)

Formato por endpoint: Método URL — Resumen — Request — Response — Códigos esperados — Casos de error

---

### Módulo: Auth

- POST /api/auth/login — Autenticar usuario
  - Request: { "username": string, "password": string }
  - Response 200: { "accessToken": string, "refreshToken": string, "user": { id, nombre, rol } }
  - Errores: 401 credenciales inválidas

- POST /api/auth/refresh — Refrescar token
  - Request: { "refreshToken": string }
  - Response 200: { "accessToken": string }
  - Errores: 401 refresh inválido/expirado

- POST /api/auth/logout — Invalidar refresh
  - Auth required
  - Response 204

Requisitos de seguridad:
- JWT con `exp`, `jti`. Refresh tokens almacenados con revocación posible.
- Rate-limit: 5 intentos / minuto por IP para login.

Casos TestSprite:
- Login correcto -> 200 + accessToken
- Login con credenciales inválidas -> 401
- Refresh válido -> 200
- Refresh inválido -> 401

---

### Módulo: Usuarios

Model: Usuario { id, nombre, email, passwordHash, rol, activo, creadoEn }

- GET /api/usuarios?page=&pageSize=&q= — Listar usuarios (admin)
  - Response 200: { items: Usuario[], total }

- POST /api/usuarios — Crear usuario (admin)
  - Request: { nombre, email, password, rol }
  - Response 201: Usuario (sin passwordHash)
  - Validaciones: email único

- GET /api/usuarios/{id} — Detalle
- PUT /api/usuarios/{id} — Actualizar (no exponer passwordHash)
- DELETE /api/usuarios/{id} — Marcar inactivo (soft delete)

Casos TestSprite:
- Crear usuario con email duplicado -> 422
- Crear y luego obtener -> 201 y 200
- Actualizar rol y verificar permisos en endpoints protegidos

---

### Módulo: Productos

Model: Producto { id, nombre, precio, codigo, categoria, stock, activo }

- GET /api/productos?query=&page=&pageSize= — Búsqueda y autocompletar
- POST /api/productos — Crear producto
- GET /api/productos/{id}
- PUT /api/productos/{id}
- DELETE /api/productos/{id} — soft delete

Casos TestSprite:
- Crear producto -> verificar en listado
- Venta que decrementa stock -> stock actualizado (si aplica)
- Crear producto con datos inválidos (precio negativo) -> 422

---

### Módulo: Ingredientes

Model: Ingrediente { id, nombre, unidad, stock }
- CRUD similar a productos.
- Integración opcional: decrementar inventario cuando se confirma venta si recipe mapping existe (fuera de alcance MVP).

Casos TestSprite:
- CRUD ingredientes básicos

---

### Módulo: Caja

Model: CajaTurno { id, usuarioId, montoInicial, saldoActual, abierto: boolean, fechaApertura, fechaCierre, resumen }

- GET /api/caja/estado — Estado del turno actual (si existe)
  - Response: 200 { turno | null }

- POST /api/caja — Abrir caja
  - Request: { usuarioId, montoInicial }
  - Response 201: turno creado
  - Validaciones: no abrir si ya existe caja abierta por la misma terminal (control por terminalId o sessionId)

- POST /api/caja/{id}/cerrar — Cerrar caja
  - Request: { montoConteo, notas? }
  - Response 200: resumen con total ventas, formas de pago
  - Reglas: calcular totales a partir de transacciones relacionadas con `cajaId` entre fechaApertura y fechaCierre

Casos TestSprite:
- Abrir caja -> 201
- Intentar abrir caja duplicada -> 409 (conflicto)
- Registrar ventas asociadas y cerrar -> comprobación totales igual a suma de transacciones

---

### Módulo: Transacciones

Model: Transaccion { id, cajaId, usuarioId, items: [{ productoId, cantidad, precio }], subtotal, impuestos, descuentos, total, metodoPago, estado, reciboUrl, creadoEn }

- GET /api/transacciones?from=&to=&page=&pageSize=&usuarioId=&metodoPago=&estado=
  - Response 200: { items: Transaccion[], total }

- POST /api/transacciones — Registrar venta
  - Request: {
      cajaId, usuarioId, items: [{ productoId, cantidad, precio }], metodoPago, referenciasOpcionales
    }
  - Response 201: { id, estado: 'completada', reciboUrl? }
  - Reglas transaccionales:
    - Validar existencia de `cajaId` abierto
    - Validar stock (si aplica)
    - Operación ACID: insertar transacción, decrementar stock, registrar item en ledger
    - Soportar idempotencia: usar header `Idempotency-Key` para evitar duplicados

- GET /api/transacciones/{id} — Detalle

- POST /api/transacciones/{id}/reembolso — Reembolso parcial/completo
  - Request: { monto, motivo }
  - Response 200: detalle de reembolso
  - Reglas: crear transacción inversa o registro en ledger, actualizar stock si aplica

Casos TestSprite (detallados más adelante):
- Registrar venta válida -> 201 y total correcto
- Registrar venta con `Idempotency-Key` duplicada -> 200/201 sin duplicar (idempotencia)
- Registrar venta cuando caja está cerrada -> 400/409
- Reembolso parcial -> 200 y registro contable correcto

---

### Módulo: Dashboard / Reportes

Endpoints de resumen para UI:
- GET /api/dashboard/ventas?from=&to= — KPIs: totalVentas, tickets, ticketPromedio, topProductos
- GET /api/dashboard/caja-resumen?from=&to=

Casos TestSprite:
- Consultar KPIs con datos seed -> valores esperados

---

## Modelado de datos y migraciones

- Usar Drizzle ORM (ya presente en repo). Mantener migraciones en `drizzle/`.
- Recomendación: migraciones idempotentes, con archivos numerados (0001_..., 0002_...)

Esquema básico SQL (resumen):

- usuarios (id PK, nombre, email unique, password_hash, rol, activo, creado_en)
- productos (id, nombre, precio, codigo unique, categoria, stock, activo)
- ingredientes (id, nombre, unidad, stock)
- caja_turnos (id, usuario_id FK, monto_inicial, abierto boolean, fecha_apertura, fecha_cierre, resumen JSON)
- transacciones (id, caja_id FK, usuario_id FK, subtotal, impuestos, descuentos, total, metodo_pago, estado, creado_en)
- transaccion_items (id, transaccion_id FK, producto_id FK, cantidad, precio)
- idempotency_keys (key, usuario_id, response_snapshot, creado_en)

Migraciones claves:
- Crear tablas + índices en campos `email`, `codigo`, `fecha`.
- FK con `ON DELETE SET NULL` donde convenga.

## Reglas transaccionales y concurrencia

- Registrar venta debe ser ACID: envolver en transacción DB.
- Usar row-level locking o decrementos atomicos para `stock` (UPDATE ... WHERE stock >= qty RETURNING stock)
- Reintentos: aplicar `Idempotency-Key` para POST /transacciones; persistir mapping key->transaccionId

## Validación y errores

- Errores estandarizados: devolver body { code: string, message: string, details?: object }
- HTTP codes: 200/201 success, 204 no-content, 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 409 conflict, 422 validation error, 500 internal

## Observabilidad

- Logs estructurados (JSON) con requestId, usuarioId, ruta, latencia, status.
- Métricas Prometheus: request_count, request_duration_seconds, db_query_duration, failed_jobs_count.
- Tracing (opcional): OpenTelemetry para instrumentar requests críticos (registro de ventas, cierre de caja).

## Seguridad

- Enforce HTTPS
- Rate limiting en endpoints sensibles (login, transacciones) configurable
- Validaciones de tamaño de payload
- Sanitización de inputs
- Almacenamiento de passwords con bcrypt/argon2
- Secrets rotación vía Vault / variables de entorno seguras

## Jobs y procesos background

- Colas (BullMQ / RabbitMQ) para: procesos de reenvío de recibos, conciliación offline, generación de reportes largos.
- Job para reconciliar transacciones pendientes en modo offline.

## Integraciones externas

- Servicio de correo para notificaciones (opcional)
- Webhooks para sistemas externos (order created)
- Pasarelas de pago: diseñar como integración opcional (campo `paymentInfo` para pasarela)

## Contratos OpenAPI / Postman

- Generar y mantener spec OpenAPI en `api-backend/docs/openapi.yaml`.
- Proveer Postman collection para QA y TestSprite.

## Testing: Strategy & TestSprite cases (lista ejecutable)

Preamble: cada caso incluye Precondiciones, Steps (request), Headers, Body, Expected HTTP status y Assertion sobre payload/DB.

Organización: testsprite puede ejecutar secuencia de requests; incluimos fixtures y orden recomendado.

1) Fixture inicial (seed data)
- Crear roles y usuarios: admin@local (admin), cajero@local (cajero)
- Crear productos: Producto A (precio 10, stock 100), Producto B (precio 5, stock 50)
- Opcional: crear caja abierta para terminal de pruebas

2) Auth flow
- Test A1: Login admin
  - POST /api/auth/login { username: "admin@local", password: "Pass123!" }
  - Esperar 200, guardar `accessToken`, `refreshToken`

- Test A2: Login inválido
  - POST /api/auth/login con contraseña errónea -> 401

3) Usuarios
- Test U1: Crear usuario nuevo (admin)
  - POST /api/usuarios Authorization: Bearer adminToken
  - Body { nombre, email, password, rol }
  - Esperar 201 y poder GET /api/usuarios/{id}

4) Caja
- Test C1: Abrir caja (cajero)
  - POST /api/auth/login -> cajeroToken
  - POST /api/caja { usuarioId: cajero.id, montoInicial: 100.0 } Authorization: Bearer cajeroToken
  - Esperar 201, body.turno.abierto == true

- Test C2: Intento abrir caja duplicada
  - Mismo terminal/usuario -> Esperar 409

5) Registrar Venta (flujo crítico)
- Test T1: Venta simple
  - POST /api/transacciones
  - Headers: Authorization: Bearer cajeroToken, Idempotency-Key: uuid-1
  - Body: { cajaId, usuarioId: cajero.id, items: [{ productoId: A.id, cantidad: 2, precio: 10 }], metodoPago: "efectivo" }
  - Esperar 201
  - Assertions:
    - response.total == 20
    - DB: transaccion creada con items count 1
    - stock of Producto A decremented by 2

- Test T2: Idempotencia
  - Repetir POST con mismo `Idempotency-Key` -> no crear duplicado, status 200/201 consistent, same transaccionId

- Test T3: Venta cuando caja cerrada
  - POST con caja cerrada -> 409/400

6) Reembolso
- Test R1: Reembolso parcial
  - POST /api/transacciones/{id}/reembolso { monto: 5, motivo }
  - Esperar 200 y DB registra reembolso

7) Listados y filtros
- Test L1: Listar transacciones por fecha
  - GET /api/transacciones?from=YYYY-MM-DD&to=YYYY-MM-DD
  - Esperar 200, items include transacciones creadas

8) Productos/Stock edge cases
- Test P1: Registrar venta con cantidad > stock -> 422
- Test P2: Actualizar producto y verificar cambios en GET

9) Dashboard
- Test D1: GET /api/dashboard/ventas?from=&to= -> valores que correspondan al seed

10) Concurrency stress (Test de integridad)
- Simular 2 requests concurrentes para decrementar el mismo stock (race condition)
  - Ejecutar 2 POST /api/transacciones con items sobre Producto A stock suficiente sólo para uno
  - Resultado esperado: una transaccion OK, la otra 422 o 409 por stock insuficiente; DB stock nunca negativo

11) Security
- Test S1: Acceso sin token a endpoint protegido -> 401
- Test S2: Usuario con rol `cajero` intentando crear usuario -> 403

Formato sugerido para cada test de TestSprite (JSON):
{
  "name": "Nombre del test",
  "requests": [
    { "method": "POST", "url": "/api/auth/login", "body": {...}, "assert": {"status":200, "json.path":"accessToken"} },
    ...
  ]
}

(Adaptar según especificación interna de TestSprite en repo `testsprite_tests/`.)

## Datos de prueba (Fixtures)

Seed recomendada (JSON):
- usuarios: admin@local (pass), cajero@local (pass)
- productos: 5 productos con distintos precios y stock
- caja: no creada (los tests deben crearla explictamente)

Colocar fixtures en `api-backend/test/fixtures/seed.json` y script `npm run seed:dev`.

## CI / Pipeline

- GitHub Actions / Railway: pasos mínimos
  - Lint
  - Unit tests
  - Build
  - Migraciones en entorno de pruebas
  - Ejecutar tests integracion/TestSprite contra instancia ephemeral (docker-compose test)

Ejemplo de job para tests automatizados:
- Levantar DB (Postgres) via service
- Ejecutar migraciones
- Ejecutar seed
- Ejecutar TestSprite suite apuntando a `http://localhost:3000`

## Run local / comandos útiles

- Instalar dependencias: `pnpm install` (o `npm install`)
- Levantar DB: `docker-compose up -d db`
- Ejecutar migraciones: `pnpm drizzle migrate:up` (ajustar script)
- Levantar servidor: `pnpm dev` (o `pnpm start` para prod)
- Ejecutar seed: `pnpm seed:dev`
- Ejecutar TestSprite suite (local): `pnpm testsprite run --config testsprite_tests/config.json`

## Criterios de aceptación (por módulo)

- Auth: login y refresh functional, tokens válidos, revocación de refresh posible.
- Usuarios/Productos/Ingredientes: CRUD completo con validaciones (422 para inputs inválidos) y tests unitarios.
- Caja: abrir/cerrar con resumen coincide con suma de transacciones.
- Transacciones: ACID, idempotencia, stock consistente bajo concurrencia.
- Dashboard: KPIs calculadas correctamente sobre datos seed.
- Observabilidad: logs y métricas básicos presentes.

## Entregables

- Código del API con endpoints implementados y cubiertos por tests unitarios
- Migraciones en `drizzle/`
- `api-backend/docs/openapi.yaml` actualizado
- `api-backend/test/fixtures/seed.json` y scripts de seed
- Suite TestSprite en `testsprite_tests/backend` con los casos listados

## Apéndice: Ejemplos de payloads y respuestas

- POST /api/transacciones (venta)
Request:
{
  "cajaId": 1,
  "usuarioId": 2,
  "items": [ { "productoId": 3, "cantidad": 2, "precio": 12.5 } ],
  "metodoPago": "efectivo"
}

Response 201:
{
  "id": 345,
  "estado": "completada",
  "total": 25.0,
  "reciboUrl": "/receipts/345.pdf"
}

- Error ejemplo (stock insuficiente) 422:
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Producto 3 no tiene stock suficiente",
  "details": { "productoId": 3, "stockActual": 1 }
}

---

Si quieres, puedo:
- Generar automáticamente la colección Postman/Postman-JSON basada en estos contratos.
- Extraer definiciones reales desde `src` y `drizzle` para completar modelos exactos.
- Crear la carpeta `testsprite_tests/backend` con archivos de prueba listos para ejecutar.


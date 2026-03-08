# Dashboard Module

Módulo que expone estadísticas en tiempo real del restaurante para el dashboard administrativo.

## Endpoint

### `GET /api/dashboard/stats`

**Autenticación:** Bearer JWT requerido  
**Roles:** Todos (admin, cajero, cocina)

#### Respuesta exitosa `200 OK`

```json
{
  "totalUsuarios": 4,
  "totalProductos": 12,
  "totalPlatos": 8,
  "transaccionesHoy": 15,
  "ordenesAbiertas": 3,
  "ingresosHoy": "850.00",
  "actividadReciente": [
    {
      "id": 42,
      "concepto": "Mesa 3 - Almuerzo",
      "mesa": "Mesa 3",
      "estado": "abierto",
      "monto_total": "120.00",
      "hora": "2026-03-07T14:32:00.000Z"
    }
  ]
}
```

#### Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `totalUsuarios` | `number` | Usuarios activos (sin `borrado_en`) |
| `totalProductos` | `number` | Productos activos en inventario |
| `totalPlatos` | `number` | Platos activos en el menú |
| `transaccionesHoy` | `number` | Total de transacciones del día actual |
| `ordenesAbiertas` | `number` | Transacciones con estado `pendiente` o `abierto` hoy |
| `ingresosHoy` | `string` | Suma de `monto_total` de transacciones `cerrado` hoy (2 decimales) |
| `actividadReciente` | `array` | Últimas 5 transacciones del día ordenadas por hora desc |

#### Respuestas de error

| Código | Descripción |
|--------|-------------|
| `401` | Token JWT ausente o inválido |

## Archivos

```
src/modules/dashboard/
├── dashboard.module.ts      — Módulo NestJS
├── dashboard.service.ts     — Lógica de negocio + queries Drizzle ORM
└── dashboard.controller.ts  — Endpoint REST + Swagger decorators
```

## Frontend

El frontend consume este endpoint a través de:
- `src/modules/dashboard/services/dashboard.service.ts`
- `src/modules/dashboard/hooks/use-dashboard-stats.ts`
- `src/pages/dashboard-page.tsx`

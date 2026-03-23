# 📁 Estructura de Servicios - Módulo Transacciones

## 🏗️ Árbol de Directorios

```
src/modules/transacciones/
├── services/
│   ├── index.ts ⭐ (Índice centralizador)
│   ├── transacciones-core.service.ts (CRUD)
│   ├── items.service.ts (Productos/Platos)
│   ├── extras.service.ts (Personalizaciones)
│   ├── pagos.service.ts (Efectivo/QR)
│   ├── calculos-financieros.service.ts (Matemáticas)
│   ├── estados-transaccion.service.ts (Workflow)
│   ├── cocina-integration.service.ts (WebSockets)
│   ├── stock.service.ts (Inventario)
│   └── caja-reportes.service.ts (Reportes)
├── dto/
│   ├── add-extra.dto.ts
│   ├── add-item.dto.ts
│   ├── create-pago.dto.ts
│   ├── create-transaccion.dto.ts
│   └── update-transaccion.dto.ts
├── transacciones.controller.ts
├── transacciones.service.ts (Orquestador)
├── transacciones.module.ts (Registro)
├── cocina.gateway.ts (WebSocket)
└── REFACTORIZACION.md (Documentación)
```

---

## 🔗 Relaciones entre Servicios

```
┌─────────────────────────────────────────────────────┐
│        TransaccionesService (ORQUESTADOR)           │
│              Delega responsabilidades                │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ TransaccionesCoreService  │ ItemsService
│      (CRUD)      │  │  (Items/Platos)
└──────────────────┘  └──────────────────┘
        │                     │
        │                     ├────────────┬──────────┐
        │                     │            │          │
        │                     ▼            ▼          ▼
        │            ┌──────────────┐  ┌──────────┐ ┌──────────┐
        │            │ExtrasService │  │ ┌─Pagos──┴ │ ┌─Cálculos┐
        │            │(Extras)      │  │ │Service   │ │Financier│
        │            └──────────────┘  │ └───────── │ └─────────┘
        │                     │         │           │
        │                     └────┬────┘           │
        │                          │                │
        │                     ┌────▼─────┐      ┌──▼──────────┐
        │                     │   Estados   │      │  Cocina    │
        │                     │  Service    │      │Integration │
        │                     └─────────────┘      └────────────┘
        │                          │
        │             ┌────────────┼────────────┐
        │             │            │            │
        │             ▼            ▼            ▼
        │      ┌──────────────┐ ┌─────────┐ ┌───────────────┐
        │      │ StockService │ │  Caja   │ │ (Integración) │
        │      │(Inventario)  │ │Reportes │ │   WebSocket   │
        │      └──────────────┘ └─────────┘ └───────────────┘
        │
        └─────────────────────────────────────────────┘
                  Coordinación central
```

---

## 📊 Matriz de Responsabilidades

| Servicio | CRUD | Items | Extras | Pagos | Cálculos | Estados | Cocina | Stock | Reportes |
|----------|:----:|:-----:|:------:|:-----:|:--------:|:-------:|:------:|:-----:|:--------:|
| **TransaccionesCoreService** | ✅ | | | | | | | | |
| **ItemsService** | | ✅ | | | | | | | |
| **ExtrasService** | | | ✅ | | | | | | |
| **PagosService** | | | | ✅ | | | | | |
| **CalculosFinancierosService** | | | | | ✅ | | | | |
| **EstadosTransaccionService** | | | | | | ✅ | | | |
| **CocinaIntegrationService** | | | | | | | ✅ | | |
| **StockService** | | | | | | | | ✅ | |
| **CajaReportesService** | | | | | | | | | ✅ |

---

## 🔄 Flujos de Operación

### 1️⃣ Crear Transacción
```
Controller → Service
             ├─ TransaccionesCoreService.create()
             └─ CocinaIntegrationService.emitirActualizacionCocina()
```

### 2️⃣ Agregar Item
```
Controller → Service
             ├─ TransaccionesCoreService.reabrirTransaccion()
             ├─ ItemsService.addItem()
             ├─ ExtrasService.createExtrasFromDto()
             ├─ CalculosFinancierosService.calcularSubtotalItem()
             ├─ CalculosFinancierosService.calcularMontoTotal()
             ├─ EstadosTransaccionService.recalcularEstado()
             └─ CocinaIntegrationService.emitirActualizacionCocina()
```

### 3️⃣ Agregar Pago
```
Controller → Service
             ├─ TransaccionesCoreService.findOne()
             ├─ PagosService.addPago()
             ├─ TransaccionesCoreService.updateMontoPagado()
             ├─ PagosService.registrarPagoEnCaja()
             ├─ EstadosTransaccionService.recalcularEstado()
             ├─ StockService.descontarStock() [si se cierra]
             └─ CocinaIntegrationService.emitirActualizacionCocina()
```

### 4️⃣ Completar en Cocina
```
Controller → Service
             ├─ CocinaIntegrationService.completarOrdenCocina()
             ├─ EstadosTransaccionService.recalcularEstado()
             ├─ StockService.descontarStock() [si se cierra]
             └─ CocinaIntegrationService.emitPedidoCompletado()
```

### 5️⃣ Generar Reporte
```
Controller → Service
             ├─ CajaReportesService.getResumenCompletoCaja()
             ├─ CajaReportesService.getResumenItemsPorCaja()
             ├─ CajaReportesService.getResumenPagosPorCaja()
             ├─ CajaReportesService.getTotalIngresosCaja()
             └─ CajaReportesService.getTransaccionesCaja()
```

---

## 📋 Métodos por Servicio

### TransaccionesCoreService (11 métodos)
```
create()
findAll()
findOne()
update()
remove()
updateMontoTotal()
updateMontoPagado()
updateEstado()
updateEstadoCocina()
findByCaja()
reabrirTransaccion()
```

### ItemsService (6 métodos)
```
addItem()
getItems()
getItem()
removeItem()
updateSubtotal()
getItemsActivos()
```

### ExtrasService (5 métodos)
```
addExtra()
getExtras()
getExtrasActivos()
removeExtra()
createExtrasFromDto()
```

### PagosService (4 métodos)
```
addPago()
getPagos()
getTotalPagado()
registrarPagoEnCaja()
```

### CalculosFinancierosService (10 métodos)
```
calcularSubtotalItem()
calcularMontoTotal()
calcularMontoPendiente()
calcularCambio()
esPagadoCompleto()
formatearMoneda()
esMontoValido()
calcularPorcentaje()
aplicarDescuento()
calcularIVA()
```

### EstadosTransaccionService (7 métodos)
```
recalcularEstado()
updateEstado()
esTransicionValida()
getProximosEstados()
puedePagarse()
puedeCerrarse()
getDescripcionEstado()
```

### CocinaIntegrationService (5 métodos)
```
findPendientesCocina()
completarOrdenCocina()
emitirActualizacionCocina()
updateEstadoCocina()
getOrdenDetallada()
```

### StockService (5 públicos + 3 privados)
```
descontarStock()
getStockProducto()
getCantidadIngrediente()
haySufficientStock()
haySufficientIngrediente()

[Privados]
descontarProducto()
descontarIngredientesPlato()
descontarExtrasItem()
```

### CajaReportesService (6 métodos)
```
getResumenItemsPorCaja()
getResumenPagosPorCaja()
getTotalIngresosCaja()
getResumenCompletoCaja()
getTransaccionesCaja()
generarReporteCierrecaja()
```

---

## 🎯 Casos de Uso y Servicios Involucrados

| Caso de Uso | Servicios Involucrados |
|-------------|------------------------|
| **Crear transacción** | Core, Cocina |
| **Agregar productos** | Core, Items, Extras, Cálculos, Estados |
| **Registrar pago** | Core, Pagos, Estados, Stock |
| **Completar en cocina** | Cocina, Estados, Stock |
| **Generar reporte** | CajaReportes |
| **Validar stock** | Stock |
| **Calcular montos** | Cálculos |
| **Gestionar estados** | Estados |

---

## 💡 Tips de Uso

### Importaciones Simplificadas
```typescript
// Antes (ahora deprecado)
import { TransaccionesService } from './transacciones.service';

// Después (recomendado)
import { 
  TransaccionesCoreService,
  ItemsService,
  PagosService,
  // ... otros servicios
} from './services';
```

### Inyección en Otros Módulos
```typescript
@Module({
  imports: [TransaccionesModule],
  exports: [TransaccionesService], // Solo exponemos el orquestador
})
export class MiModulo {}
```

### Testing Aislado
```typescript
// Fácil de testear sin dependencias innecesarias
describe('ItemsService', () => {
  let service: ItemsService;
  let db: MockDatabase;
  
  beforeEach(async () => {
    service = new ItemsService(db);
  });
});
```

---

**Documentación actualizada**: Marzo 23, 2026

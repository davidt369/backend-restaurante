# 🔄 Refactorización del Módulo de Transacciones

## Descripción General

Se ha aplicado el **Principio de Responsabilidad Única (SRP)** al módulo de transacciones, dividiendo el monolítico `TransaccionesService` en 9 servicios especializados y altamente enfocados.

---

## 📋 Servicios Especializados

### 1. **TransaccionesCoreService**
**Responsabilidad**: Gestión básica de transacciones (CRUD)

Encargado del CRUD (Crear, Leer, Actualizar, Borrar) de transacciones. Solo guarda o recupera la cabecera de la transacción de la base de datos sin tomar decisiones de negocio complejas.

**Métodos principales**:
- `create()` - Crear nueva transacción
- `findAll()` - Obtener todas las transacciones
- `findOne()` - Obtener una transacción específica
- `update()` - Actualizar transacción
- `remove()` - Eliminar (soft delete) transacción
- `updateMontoTotal()` - Actualizar monto total
- `updateMontoPagado()` - Actualizar monto pagado
- `updateEstado()` - Actualizar estado
- `reabrirTransaccion()` - Reabrir una transacción cerrada

---

### 2. **ItemsService**
**Responsabilidad**: Gestión de artículos (productos y platos) en pedidos

Maneja la lógica de los artículos dentro de un pedido. Valida si el producto existe, calcula precios unitarios y subtotales.

**Métodos principales**:
- `addItem()` - Agregar artículo a una transacción
- `getItems()` - Obtener todos los artículos
- `getItem()` - Obtener un artículo específico
- `removeItem()` - Eliminar un artículo
- `updateSubtotal()` - Actualizar subtotal
- `getItemsActivos()` - Obtener artículos activos para cálculos

---

### 3. **ExtrasService**
**Responsabilidad**: Gestión de personalizaciones de productos

Maneja modificaciones de productos (extras). Si una hamburguesa lleva "extra de queso", este servicio gestiona ese añadido, permitiendo reglas complejas.

**Métodos principales**:
- `addExtra()` - Agregar extra a un artículo
- `getExtras()` - Obtener extras de un artículo
- `getExtrasActivos()` - Obtener extras activos para cálculos
- `removeExtra()` - Eliminar un extra
- `createExtrasFromDto()` - Crear múltiples extras desde DTO

---

### 4. **PagosService**
**Responsabilidad**: Flujo de dinero y validaciones financieras

Gestiona métodos de pago (efectivo, QR). Asegura que no se pague más de lo debido y calcula el cambio.

**Métodos principales**:
- `addPago()` - Registrar un pago
- `getPagos()` - Obtener todos los pagos de una transacción
- `getTotalPagado()` - Calcular total pagado
- `registrarPagoEnCaja()` - Registrar pago en caja

---

### 5. **CalculosFinancierosService**
**Responsabilidad**: Lógica matemática y precisión de cálculos

Servicio puramente lógico que centraliza todas las fórmulas financieras. Si en el futuro se apliquen impuestos (IVA) o descuentos, solo se modifica este servicio.

**Métodos principales**:
- `calcularSubtotalItem()` - Calcular subtotal de un artículo
- `calcularMontoTotal()` - Calcular monto total de una transacción
- `calcularMontoPendiente()` - Calcular cantidad pendiente
- `calcularCambio()` - Calcular cambio en efectivo
- `esPagadoCompleto()` - Validar si está completamente pagado
- `formatearMoneda()` - Formatear a moneda (2 decimales)
- `calcularPorcentaje()` - Calcular porcentaje (para impuestos)
- `aplicarDescuento()` - Aplicar descuento
- `calcularIVA()` - Calcular IVA (cuando se implemente)

---

### 6. **EstadosTransaccionService**
**Responsabilidad**: Control del workflow de estados

Controla el ciclo de vida: Pendiente → Pagada → En Cocina → Completada. Garantiza que no se salten pasos.

**Métodos principales**:
- `recalcularEstado()` - Determinar nuevo estado basado en condiciones
- `updateEstado()` - Actualizar estado
- `esTransicionValida()` - Validar transición entre estados
- `getProximosEstados()` - Obtener estados válidos siguientes
- `puedePagarse()` - Validar si puede pagarse
- `puedeCerrarse()` - Validar si puede cerrarse
- `getDescripcionEstado()` - Obtener descripción del estado

---

### 7. **CocinaIntegrationService**
**Responsabilidad**: Integración técnica con el área de producción

Puente con la cocina. Gestiona WebSockets y comunicación en tiempo real, aislado de cobros o stock.

**Métodos principales**:
- `findPendientesCocina()` - Obtener pedidos pendientes
- `completarOrdenCocina()` - Marcar orden como completada
- `emitirActualizacionCocina()` - Emitir eventos a clientes
- `updateEstadoCocina()` - Actualizar estado de cocina
- `getOrdenDetallada()` - Obtener orden completa con detalles

---

### 8. **StockService**
**Responsabilidad**: Control de inventario

Maneja existencias físicas. Al cerrar una venta, descuenta ingredientes y productos del stock.

**Métodos principales**:
- `descontarStock()` - Descontar stock de toda una transacción
- `getStockProducto()` - Obtener stock de un producto
- `getCantidadIngrediente()` - Obtener cantidad de ingrediente
- `haySufficientStock()` - Validar stock disponible
- `haySufficientIngrediente()` - Validar disponibilidad de ingrediente

**Métodos privados**:
- `descontarProducto()` - Descontar stock de un producto
- `descontarIngredientesPlato()` - Descontar ingredientes de un plato
- `descontarExtrasItem()` - Descontar extras

---

### 9. **CajaReportesService**
**Responsabilidad**: Auditoría y reportes de caja

Enfocado en cierre de caja y reportes. No afecta operación de venta, solo consulta datos.

**Métodos principales**:
- `getResumenItemsPorCaja()` - Resumen de ventas por producto/plato
- `getResumenPagosPorCaja()` - Resumen de pagos por método
- `getTotalIngresosCaja()` - Total de ingresos de una caja
- `getResumenCompletoCaja()` - Resumen completo de caja
- `getTransaccionesCaja()` - Transacciones de una caja
- `generarReporteCierrecaja()` - Generar reporte de cierre

---

## 🏗️ TransaccionesService (Orquestador)

El servicio principal ahora actúa como **orquestador**, delegando responsabilidades a los servicios especializados:

```typescript
// Ejemplo de delegación
async addItem(transaccionId, addItemDto) {
  // Validar existencia
  const transaccion = await this.transaccionesCoreService.findOne(transaccionId);
  
  // Agregar item
  const item = await this.itemsService.addItem(transaccionId, addItemDto);
  
  // Manejar extras
  if (addItemDto.extras) {
    await this.extrasService.createExtrasFromDto(item.id, addItemDto.extras);
    await this.recalcularSubtotalItem(item.id);
  }
  
  // Recalcular totales
  await this.recalcularMontoTotal(transaccionId);
  
  // Actualizar estado
  await this.actualizarEstadoTransaccion(transaccionId);
  
  // Emitir evento
  await this.cocinaService.emitirActualizacionCocina();
}
```

---

## 📁 Estructura de Carpetas

```
src/modules/transacciones/
├── services/
│   ├── index.ts                          # Índice centralizador
│   ├── transacciones-core.service.ts     # CRUD
│   ├── items.service.ts                  # Productos/Platos
│   ├── extras.service.ts                 # Personalizaciones
│   ├── pagos.service.ts                  # Flujo de dinero
│   ├── calculos-financieros.service.ts   # Lógica matemática
│   ├── estados-transaccion.service.ts    # Workflow
│   ├── cocina-integration.service.ts     # Integración cocina
│   ├── stock.service.ts                  # Inventario
│   └── caja-reportes.service.ts          # Reportes
├── dto/
├── transacciones.controller.ts
├── transacciones.service.ts              # Orquestador
├── transacciones.module.ts
├── cocina.gateway.ts
└── REFACTORIZATION.md                    # Este archivo
```

---

## ✅ Beneficios de la Refactorización

### 1. **Mantenibilidad**
- Cada servicio tiene una única razón para cambiar
- Código más legible y comprensible
- Fácil localizar funcionalidad específica

### 2. **Testabilidad**
- Servicios pequeños y enfocados son fáciles de testear
- Posibilidad de hacer unit tests aislados
- Mocks más simples

### 3. **Reutilización**
- Servicios pueden usarse en otros módulos
- Lógica independiente y modular

### 4. **Escalabilidad**
- Fácil agregar nuevas funcionalidades
- Cambios en una área no afectan otras
- Base sólida para crecimiento

### 5. **Manejo de Errores**
- Errores más localizados y específicos
- Stack traces más claros

---

## 🔗 Flujo de una Transacción Completa

```
1. Crear Transacción
   └─> TransaccionesCoreService.create()

2. Agregar Items
   └─> ItemsService.addItem()
   └─> ExtrasService.createExtrasFromDto()
   └─> CalculosFinancierosService.calcularSubtotalItem()
   └─> CalculosFinancierosService.calcularMontoTotal()

3. Agregar Pagos
   └─> PagosService.addPago()
   └─> PagosService.registrarPagoEnCaja()
   └─> EstadosTransaccionService.recalcularEstado()

4. Completar Cocina
   └─> CocinaIntegrationService.completarOrdenCocina()
   └─> EstadosTransaccionService.recalcularEstado()

5. Cerrar Transacción
   └─> StockService.descontarStock()
   └─> CajaReportesService.generarReporteCierrecaja()
```

---

## 🚀 Próximas Mejoras

1. **Autores y auditoría**: Agregar quién hizo cada cambio
2. **Caché**: Implementar caché para reportes frecuentes
3. **Transacciones de BD**: Agrupar operaciones en txns
4. **Validaciones extensas**: Agregar más validaciones de stock
5. **Historial completo**: Mantener auditoría de cambios
6. **Webhooks**: Integración con sistemas externos

---

## 📚 Documentación Adicional

Ver también:
- [AUTH_MODULE.md](../docs/AUTH_MODULE.md)
- [CAJA_MODULE.md](../docs/CAJA_MODULE.md)
- [DASHBOARD_MODULE.md](../docs/DASHBOARD_MODULE.md)

---

**Refactorización completada**: Marzo 2026

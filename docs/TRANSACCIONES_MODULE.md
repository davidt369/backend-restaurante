# Módulo de Transacciones (Pedidos y Pagos)

## 📋 Descripción General

Sistema completo de gestión de pedidos, pagos y control de inventario para restaurante. Permite registrar órdenes, procesar pagos mixtos, gestionar extras, y descontar automáticamente el stock cuando se completan los pagos.

## 🗂️ Estructura de Tablas

### 1. **transacciones** (Pedidos/Órdenes)
Tabla principal que almacena cada pedido realizado en el restaurante.

**Campos principales:**
- `id`: Identificador único del pedido
- `nro_reg`: Número de registro secuencial
- `fecha`, `hora`: Marca temporal del pedido
- `tipo`: Tipo de transacción (venta, cortesía, etc.)
- `concepto`: Descripción del pedido
- `monto_total`: Total a cobrar
- `monto_pagado`: Total ya pagado
- `monto_pendiente`: Calculado automáticamente (total - pagado)
- `mesa`: Ubicación del servicio (Mesa 5, Para llevar, Delivery, Auto, etc.)
- `cliente`: Nombre del cliente
- `estado`: Estado del pedido (pendiente, abierto, cerrado)
- `caja_id`: Referencia a la caja/turno actual
- `usuario_id`: Usuario que creó el pedido

**Estados posibles:**
- `pendiente`: Pedido nuevo, aún no se ha iniciado
- `abierto`: Pedido en proceso (puede tener items, puede agregar más)
- `cerrado`: Pedido completado y totalmente pagado

### 2. **detalle_items** (Items del Pedido)
Items individuales dentro de cada pedido.

**Campos principales:**
- `transaccion_id`: Referencia al pedido
- `producto_id` O `plato_id`: Item pedido (excluyente, solo uno puede estar lleno)
- `cantidad`: Cantidad ordenada
- `precio_unitario`: Precio al momento de la venta
- `subtotal`: cantidad × precio_unitario
- `notas`: Instrucciones especiales ("Sin cebolla", "Punto medio", etc.)

**Restricción:** Solo puede ser producto O plato, no ambos simultáneamente.

### 3. **detalle_item_extras** (Extras/Agregados)
Extras adicionales para cada item del pedido.

**Campos principales:**
- `detalle_item_id`: Referencia al item
- `ingrediente_id` O `descripcion`: Extra pedido
  - Si es ingrediente conocido, usa `ingrediente_id`
  - Si es extra libre, usa `descripcion` ("Extra queso", "Doble carne")
- `precio`: Precio del extra
- `cantidad`: Cantidad del extra

**Restricción:** Debe tener ingrediente_id O descripcion (al menos uno).

### 4. **pagos** (Pagos Realizados)
Registra cada pago realizado a un pedido. Soporta pagos parciales y múltiples métodos.

**Campos principales:**
- `transaccion_id`: Referencia al pedido
- `metodo_pago`: "efectivo" o "qr"
- `monto`: Monto de este pago
- `monto_recibido`: Solo para efectivo (ej: paga con 100)
- `cambio`: Calculado automáticamente (recibido - monto)
- `referencia_qr`: Código de transacción para pagos QR
- `usuario_id`: Usuario que registró el pago

## 🔄 Flujos de Trabajo

### Flujo 1: Crear Nuevo Pedido
```
1. Usuario crea transacción con estado "pendiente"
2. Agrega items (productos o platos) con sus cantidades
3. Opcionalmente agrega extras a cada item
4. Calcula monto_total automáticamente
5. Cambia estado a "abierto"
```

### Flujo 2: Agregar Items a Pedido Existente
```
1. Buscar transacción por ID
2. Verificar que estado != "cerrado"
3. Agregar nuevos items
4. Recalcular monto_total
5. Si era "cerrado" y se reabre, cambiar estado a "abierto"
```

### Flujo 3: Procesar Pago (Simple o Mixto)
```
1. Verificar monto_pendiente > 0
2. Registrar pago en tabla "pagos"
   - Si efectivo: registrar monto_recibido, calcular cambio
   - Si QR: registrar referencia_qr
3. Actualizar monto_pagado en transacción
4. Si monto_pagado >= monto_total:
   - Cambiar estado a "cerrado"
   - **DESCONTAR STOCK** (productos e ingredientes)
```

**Pagos mixtos:** Crear múltiples registros en tabla `pagos`
```
Ejemplo: Cuenta de 100 Bs
- Pago 1: 50 Bs efectivo
- Pago 2: 50 Bs QR
```

### Flujo 4: Descuento de Stock (Al cerrar pedido)
```
Cuando estado cambia a "cerrado":
1. Por cada detalle_item:
   - Si es producto:
     * Descontar cantidad del stock de productos
   - Si es plato:
     * Buscar ingredientes del plato en plato_ingredientes
     * Por cada ingrediente:
       - Descontar (cantidad_plato × cantidad_ingrediente)
       
2. Por cada detalle_item_extras:
   - Si tiene ingrediente_id:
     * Descontar cantidad del ingrediente
```

## 💡 Casos de Uso Especiales

### Caso 1: Cliente pide más después de pagar
```
OPCIÓN A: Agregar item directamente (reapertura automática)
1. POST /transacciones/:id/items (agregar nuevo item)
2. El sistema detecta que estado = "cerrado"
3. Reabre automáticamente la transacción (estado → "abierto")
4. Agrega el nuevo item
5. Recalcula monto_total
6. monto_pendiente = monto_total - monto_pagado (lo ya pagado NO se toca)
7. Solo cobrar la diferencia (monto_pendiente)

OPCIÓN B: Reabrir manualmente primero
1. POST /transacciones/:id/reabrir
2. Cambiar estado de "cerrado" a "abierto"
3. Agregar nuevos items
4. Calcular nuevo monto_total
5. monto_pendiente se actualiza automáticamente (total - pagado)
6. Solo cobrar la diferencia

Ejemplo:
- Cuenta original: 100 Bs (pagado completo)
- Cliente pide extras por 30 Bs más
- Nuevo total: 130 Bs
- Ya pagado: 100 Bs
- Monto pendiente: 30 Bs
- Solo cobrar 30 Bs adicionales
```

### Caso 2: Pago con billete mayor
```
Cuenta: 80 Bs, Cliente paga con 100 Bs
1. Crear pago:
   - metodo_pago: "efectivo"
   - monto: 80
   - monto_recibido: 100
2. El campo "cambio" se calcula automáticamente: 20 Bs
3. Mostrar al cajero: "Dar cambio: 20 Bs"
```

### Caso 3: Plato con extras personalizados
```
Ejemplo: Hamburguesa con extras
1. Crear detalle_item:
   - plato_id: "hamburguesa_clasica"
   - precio_unitario: 35
   - notas: "Punto medio"
   
2. Agregar extras:
   - Extra 1: ingrediente_id="queso_cheddar", precio=5
   - Extra 2: descripcion="Doble carne", precio=10
   
Subtotal: 35 + 5 + 10 = 50 Bs
```

### Caso 4: Mantener arqueo de caja
```
- Cada transacción cerrada registra en qué caja_id se realizó
- Los pagos efectivo suman a ventas_efectivo
- Los pagos QR suman a ventas_qr
- Al cerrar turno, validar:
  ventas_efectivo + ventas_qr = Total de pagos del día
```

## 📊 Consultas Útiles

### Ver pedidos pendientes de pago
```sql
SELECT * FROM transacciones 
WHERE estado != 'cerrado' 
AND borrado_en IS NULL
ORDER BY hora DESC;
```

### Ver monto pendiente de una mesa
```sql
SELECT mesa, monto_pendiente, monto_total
FROM transacciones
WHERE mesa = 'Mesa 5' 
AND estado != 'cerrado'
AND borrado_en IS NULL;
```

### Ver desglose de un pedido
```sql
SELECT 
  di.id,
  COALESCE(p.nombre, pl.nombre) as item,
  di.cantidad,
  di.precio_unitario,
  di.subtotal,
  di.notas
FROM detalle_items di
LEFT JOIN productos p ON di.producto_id = p.id
LEFT JOIN platos pl ON di.plato_id = pl.id
WHERE di.transaccion_id = 123
AND di.borrado_en IS NULL;
```

### Ver extras de un item
```sql
SELECT 
  COALESCE(i.nombre, die.descripcion) as extra,
  die.cantidad,
  die.precio
FROM detalle_item_extras die
LEFT JOIN ingredientes i ON die.ingrediente_id = i.id
WHERE die.detalle_item_id = 456
AND die.borrado_en IS NULL;
```

### Ver pagos realizados a un pedido
```sql
SELECT 
  metodo_pago,
  monto,
  monto_recibido,
  cambio,
  referencia_qr,
  creado_en
FROM pagos
WHERE transaccion_id = 123
AND borrado_en IS NULL
ORDER BY creado_en;
```

## ⚠️ Validaciones Importantes

1. **Al crear item:** Verificar que tenga producto_id O plato_id (no ambos)
2. **Al crear extra:** Verificar que tenga ingrediente_id O descripcion
3. **Al cerrar pedido:** Verificar que monto_pagado >= monto_total
4. **Al descontar stock:** Verificar que haya suficiente cantidad disponible
5. **Pagos efectivo:** Validar que monto_recibido >= monto
6. **Reabrir pedido:** El sistema lo hace automáticamente al agregar items a transacción cerrada

## 🚀 API Endpoints Disponibles

### Transacciones
- `POST /transacciones` - Crear nueva transacción
- `GET /transacciones` - Listar todas las transacciones activas
- `GET /transacciones/:id` - Obtener una transacción específica
- `PATCH /transacciones/:id` - Actualizar transacción (mesa, cliente, etc.)
- `DELETE /transacciones/:id` - Eliminar transacción (soft delete, solo admin)
- `POST /transacciones/:id/reabrir` - Reabrir transacción cerrada manualmente

### Items (Platos/Productos en el pedido)
- `GET /transacciones/:id/items` - Listar items de una transacción
- `POST /transacciones/:id/items` - Agregar item (producto o plato)
- `PATCH /transacciones/:id/items/:itemId` - Actualizar cantidad de un item
- `DELETE /transacciones/:id/items/:itemId` - Eliminar item del pedido

### Extras (Agregados a items)
- `GET /transacciones/:id/items/:itemId/extras` - Listar extras de un item
- `POST /transacciones/:id/items/:itemId/extras` - Agregar extra a un item
- `DELETE /transacciones/:id/items/:itemId/extras/:extraId` - Eliminar extra

### Pagos
- `GET /transacciones/:id/pagos` - Listar pagos realizados
- `POST /transacciones/:id/pagos` - Registrar un pago (efectivo o QR)

## 🎯 Próximos Pasos (Desarrollo Frontend)

1. ~~Crear módulo `transacciones` con service, controller y DTOs~~ ✅ COMPLETADO

2. ~~Implementar lógica de descuento de stock~~ ✅ COMPLETADO

3. ~~Implementar reapertura automática de transacciones~~ ✅ COMPLETADO

4. Frontend:
   - Pantalla de toma de pedidos (POS)
   - Pantalla de pago con calculadora
   - Vista de mesas/órdenes abiertas
   - Reporte de ventas por turno

## 📝 Notas Técnicas

- Todos los campos monetarios usan `NUMERIC(10,2)` para precisión
- Los campos calculados (monto_pendiente, cambio) usan `GENERATED ALWAYS AS`
- Soft delete implementado con `borrado_en`
- Todas las tablas tienen auditoría (creado_en, actualizado_en)
- Foreign keys con `ON DELETE CASCADE` para mantener integridad referencial

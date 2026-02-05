# 🧠 MÓDULO CAJA - Documentación

## 📋 Descripción General

El módulo de caja controla tres aspectos fundamentales del dinero en el restaurante:

1. **💵 Caja física** - Billetes y monedas
2. **📱 Dinero digital** - Pagos por QR (banco)
3. **📊 Sistema contable** - Registro y control

---

## 🔄 Flujo de Operación Diario

### 🟢 1. APERTURA (Mañana)

**Qué pasa en la vida real:**
- El cajero abre la caja física
- Cuenta el efectivo inicial (cambio)
- Registra cuántos billetes y monedas de cada denominación hay

**En el sistema:**
```
POST /api/caja/abrir
```

**Body:**
```json
{
  "b200": 2,    // 2 billetes de 200 = 400 Bs
  "b100": 5,    // 5 billetes de 100 = 500 Bs
  "b50": 10,    // 10 billetes de 50 = 500 Bs
  "b20": 15,
  "b10": 20,
  "b5": 30,
  "m2": 10,
  "m1": 20,
  "m050": 40,
  "m020": 50
}
```

**Respuesta:**
```json
{
  "id": 1,
  "fecha": "2026-02-04",
  "monto_inicial": 1400.00,  // Calculado automáticamente
  "cerrada": false
}
```

---

### 🟡 2. DURANTE EL DÍA

#### 💰 Registrar Gastos

**Qué pasa en la vida real:**
- Se necesita comprar algo (gas, limpieza, etc.)
- Se puede pagar en efectivo (sale dinero de caja) o QR (pago digital)

**En el sistema:**
```
POST /api/caja/gastos
```

**Body:**
```json
{
  "descripcion": "Compra de gas para cocina",
  "metodo_pago": "efectivo",  // o "qr"
  "monto": 50.00
}
```

#### 📊 Ver Caja Actual

```
GET /api/caja/actual
```

**Respuesta:**
```json
{
  "id": 1,
  "fecha": "2026-02-04",
  "monto_inicial": 1400.00,
  "ventas_efectivo": 2500.00,
  "ventas_qr": 1800.00,
  "total_salidas": 150.00,
  "cerrada": false
}
```

---

### 🔴 3. CIERRE (Noche)

#### Paso 1: Ver Resumen

```
GET /api/caja/resumen
```

**Respuesta:**
```json
{
  "caja": { "id": 1, "fecha": "2026-02-04" },
  "resumen": {
    "monto_inicial": 1400.00,
    "ventas_efectivo": 2500.00,
    "ventas_qr": 1800.00,
    "gastos_efectivo": 100.00,
    "gastos_qr": 50.00,
    "efectivo_esperado": 3800.00,  // inicial + ventas - gastos efectivo
    "total_qr": 1750.00,
    "total_del_dia": 4300.00
  },
  "gastos": [...]
}
```

#### Paso 2: Contar Efectivo y Cerrar

**Qué pasa en la vida real:**
- El cajero cuenta físicamente todos los billetes y monedas
- Compara con lo esperado

**En el sistema:**
```
POST /api/caja/cerrar
```

**Body:**
```json
{
  "b200": 15,
  "b100": 8,
  "b50": 12,
  "b20": 20,
  "b10": 25,
  "b5": 40,
  "m2": 15,
  "m1": 30,
  "m050": 50,
  "m020": 60,
  "cierre_obs": "Cierre normal sin novedades"
}
```

**Respuesta:**
```json
{
  "caja_id": 1,
  "fecha": "2026-02-04",
  "monto_contado": 3780.00,       // Lo que se contó físicamente
  "efectivo_esperado": 3800.00,   // Lo que debería haber
  "diferencia": -20.00,            // Faltante
  "estado_diferencia": "faltante", // exacto | sobrante | faltante
  "resumen_completo": {...}
}
```

---

## 🔑 Conceptos Clave

### ✅ Lo que SÍ hay que entender:

1. **Efectivo físico ≠ Total de ventas**
   - El efectivo solo incluye pagos en efectivo
   - Los pagos QR no entran a la caja física

2. **Efectivo esperado se calcula así:**
   ```
   monto_inicial 
   + ventas_efectivo 
   - gastos_efectivo
   ```

3. **QR NO afecta la caja física**
   - Va directo al banco
   - Se registra para la contabilidad
   - No se cuenta en el cierre físico

4. **Diferencias en el cierre:**
   - **Sobrante**: hay más dinero del esperado (posible error en registro o cambio mal dado)
   - **Faltante**: hay menos dinero del esperado (posible robo o error)
   - **Exacto**: todo cuadra perfectamente ✅

---

## 📍 Endpoints Disponibles

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| `POST` | `/api/caja/abrir` | Abrir caja con conteo inicial | admin, cajero |
| `GET` | `/api/caja/actual` | Ver caja abierta | admin, cajero |
| `POST` | `/api/caja/gastos` | Registrar gasto | admin, cajero |
| `GET` | `/api/caja/resumen` | Resumen para cierre | admin, cajero |
| `POST` | `/api/caja/cerrar` | Cerrar caja | admin, cajero |
| `GET` | `/api/caja/historial` | Ver cajas anteriores | admin |

---

## 🛡️ Validaciones Automáticas

✅ No se puede abrir caja si ya hay una abierta  
✅ No se puede registrar gasto sin caja abierta  
✅ No se puede cerrar sin caja abierta  
✅ Solo un usuario autorizado puede operar la caja  
✅ Todos los montos deben ser positivos  
✅ Las denominaciones deben ser números enteros >= 0  

---

## 🎯 Casos de Uso Reales

### Caso 1: Día normal sin problemas
```
1. Abrir caja con 1000 Bs
2. Ventas del día: 3000 Bs efectivo + 2000 Bs QR
3. Gastos: 100 Bs efectivo
4. Cierre: Deberías tener 3900 Bs en efectivo
5. Cuentas y tienes 3900 Bs → ✅ Perfecto
```

### Caso 2: Hay un faltante
```
1. Deberías tener 3900 Bs
2. Cuentas y solo tienes 3880 Bs
3. Sistema marca: Faltante de 20 Bs 🚨
4. Se investiga qué pasó
```

### Caso 3: Compra con QR
```
1. Necesitas comprar gas: 50 Bs
2. Pagas por QR
3. La caja física NO cambia
4. El sistema registra el gasto
5. Se descuenta del total QR del día
```

---

## 📊 Esquema de Base de Datos

### Tabla: `caja_turno`
```sql
- id (serial, PK)
- fecha (date, unique) 
- hora_apertura, hora_cierre (timestamptz)
- usuario_id (FK -> usuarios)
- monto_inicial (numeric)
- Conteo: b200, b100, b50, b20, b10, b5, m2, m1, m050, m020
- ventas_efectivo, ventas_qr (numeric)
- total_salidas (numeric)
- cerrada (boolean)
- cierre_obs (text)
```

### Tabla: `gastos_caja`
```sql
- id (serial, PK)
- caja_id (FK -> caja_turno)
- usuario_id (FK -> usuarios)
- descripcion (text)
- metodo_pago (efectivo | qr)
- monto (numeric)
- creado_en, actualizado_en, borrado_en
```

---

## 🚀 Próximos Pasos

1. **Integración con Ventas:** Conectar con el módulo de transacciones
2. **Reportes:** Generar reportes PDF de cierre de caja
3. **Notificaciones:** Alertas cuando hay diferencias grandes
4. **Dashboard:** Gráficos de flujo de efectivo

---

## 💡 Tips de Implementación Frontend

1. Al abrir, mostrar un formulario con inputs para cada denominación
2. Calcular el total en tiempo real mientras se ingresa
3. En el cierre, mostrar lado a lado: esperado vs contado
4. Resaltar en rojo si hay diferencias
5. No permitir editar caja ya cerrada
6. Mostrar historial con filtros por fecha

---

**¿Dudas?** Todo el código sigue las mejores prácticas de NestJS y está documentado con Swagger.

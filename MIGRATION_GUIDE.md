# 📖 Guía de Migración y Adopción - Refactorización Transacciones

**Versión**: 1.0  
**Fecha**: Marzo 23, 2026  
**Audiencia**: Desarrolladores del equipo

---

## 🎯 Objetivo

Esta guía ayuda a los desarrolladores a entender y adoptar la nueva arquitectura modular del servicio de transacciones.

---

## ✅ Checklist Pre-Migración

- [ ] Leer `REFACTORIZACION.md`
- [ ] Revisar `ARCHITECTURE.md`
- [ ] Entender el flujo de delegación
- [ ] Verificar que TypeScript compila sin errores
- [ ] Revisar los archivos de prueba existentes

---

## 📚 Documentación de Referencia

| Documento | Propósito |
|-----------|-----------|
| `REFACTORIZACION.md` | Detalles técnicos completos |
| `ARCHITECTURE.md` | Estructura y relaciones |
| `TRANSACCIONES_REFACTORING.md` | Cambios implementados |
| Este archivo | Guía de adopción |

---

## 🔍 Entendimiento de la Arquitectura

### Patrón Utilizado: **Orquestador**

```typescript
// Antes: Todo en un lugar
class TransaccionesService {
  async create() { ... }
  async addItem() { ... }
  async addPago() { ... }
  async descontarStock() { ... }
  // ... etc
}

// Después: Servicios especializados + orquestador
class TransaccionesService {
  constructor(
    private core: TransaccionesCoreService,
    private items: ItemsService,
    private pagos: PagosService,
    // ... otros servicios
  ) {}
  
  async create() {
    return this.core.create(); // Delega
  }
  
  async addItem() {
    // Orquesta múltiples servicios
    const item = await this.items.addItem();
    await this.recalcularMontoTotal();
    await this.cocinaService.emitirActualizacion();
    return item;
  }
}
```

---

## 🚀 Cómo Usar los Nuevos Servicios

### 1. En el Controller (Sin cambios)
```typescript
@Controller('transacciones')
export class TransaccionesController {
  constructor(private service: TransaccionesService) {}
  
  @Post()
  create(@Body() dto: CreateTransaccionDto) {
    return this.service.create(dto, usuario_id);
    // ^^ Sigue siendo igual
  }
}
```

### 2. En Otros Servicios
```typescript
// Si necesitas usar un servicio específico:
import { ItemsService } from './services';

@Injectable()
export class MiServicio {
  constructor(private items: ItemsService) {}
  
  async procesar() {
    const items = await this.items.getItems(transaccionId);
    return items;
  }
}
```

### 3. En Tests
```typescript
import { ItemsService } from './services';

describe('ItemsService', () => {
  let service: ItemsService;
  let mockDb: any;
  
  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnValue(mockQuery),
      insert: jest.fn().mockReturnValue(mockQuery),
    };
    
    service = new ItemsService(mockDb);
  });
  
  it('should add item', async () => {
    const result = await service.addItem(1, dto);
    expect(result).toBeDefined();
  });
});
```

---

## 🔧 Tareas Comunes

### Agregar una Nueva Funcionalidad de Items

**Antes**:
```typescript
// En TransaccionesService
async miMetodo() { ... }
```

**Después**:
```typescript
// 1. Agregar método en ItemsService
@Injectable()
export class ItemsService {
  async miMetodo() { ... }
}

// 2. Si se necesita en orquestador, agregar delegación
async miMetodo() {
  return this.itemsService.miMetodo();
}
```

### Agregar Validación Financiera Nueva

**Dónde agregar**:
```typescript
// En CalculosFinancierosService
calcularImpuestoNuevo(monto: number): number {
  // Nueva fórmula
  return monto * 0.10;
}
```

### Cambiar Lógica de Stock

**Dónde cambiar**:
```typescript
// En StockService
private async descontarProducto() {
  // Cambios aquí no afectan otras áreas
}
```

---

## 🧪 Testing

### Unit Test para un Servicio
```typescript
describe('PagosService', () => {
  let service: PagosService;
  let mockDb: jest.Mocked<NodePgDatabase>;
  
  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    } as any;
    
    service = new PagosService(mockDb);
  });
  
  describe('addPago', () => {
    it('should create payment', async () => {
      const dto = { monto: 100, metodo_pago: 'efectivo' };
      const result = await service.addPago(1, dto, 'user1', 100);
      
      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
    
    it('should validate pending amount', async () => {
      const dto = { monto: 200, metodo_pago: 'efectivo' };
      
      expect(() => 
        service.addPago(1, dto, 'user1', 100)
      ).rejects.toThrow('monto pendiente');
    });
  });
});
```

### Integration Test
```typescript
describe('TransaccionesService (Integration)', () => {
  let service: TransaccionesService;
  let coreService: TransaccionesCoreService;
  let itemsService: ItemsService;
  let pagosService: PagosService;
  let db: NodePgDatabase;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransaccionesService,
        TransaccionesCoreService,
        ItemsService,
        PagosService,
        // ... otros servicios
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();
    
    service = module.get(TransaccionesService);
  });
  
  it('should complete full transaction flow', async () => {
    const transaccion = await service.create(dto, 'user1');
    const item = await service.addItem(transaccion.id, itemDto);
    const pago = await service.addPago(transaccion.id, pagoDto, 'user1');
    
    expect(transaccion).toBeDefined();
    expect(item).toBeDefined();
    expect(pago).toBeDefined();
  });
});
```

---

## 🐛 Debugging

### Identificar Qué Servicio Maneja Algo

**Pregunta**: ¿Dónde está la lógica de cálculo de cambio?  
**Respuesta**: `PagosService.addPago()` → utiliza `CalculosFinancierosService.calcularCambio()`

**Stack de búsqueda**:
1. Buscar en `transacciones.service.ts` (orquestador)
2. Identificar qué servicio se delegó
3. Abrir ese archivo en `services/`
4. Buscar el método específico

### Usando console.log Estratégicamente

```typescript
// En CalculosFinancierosService
calcularSubtotalItem(itemId: number): number {
  console.log(`[CALC] Iniciando cálculo para item ${itemId}`);
  const subtotal = ...;
  console.log(`[CALC] Subtotal calculado: ${subtotal}`);
  return subtotal;
}

// En TransaccionesService
private async recalcularSubtotalItem(itemId: number): Promise<void> {
  console.log(`[TRANS] Recalculando subtotal del item ${itemId}`);
  const subtotal = await this.calculosService.calcularSubtotalItem(itemId);
  await this.itemsService.updateSubtotal(itemId, subtotal);
  console.log(`[TRANS] ✓ Subtotal actualizado`);
}
```

---

## 📋 Cambios que NO Requieren Actualización

- ✅ Controllers (siguen igual)
- ✅ DTOs (no cambiaron)
- ✅ Rutas HTTP (no cambiaron)
- ✅ Esquema de BD (no cambiaron)
- ✅ Tipos de datos (no cambiaron)

---

## ⚠️ Cambios Importantes a Conocer

### 1. Estructura de Carpetas
```
ANTES:
src/modules/transacciones/
└── (todos los servicios en raíz)

AHORA:
src/modules/transacciones/
└── services/ ← Nueva carpeta
```

### 2. Importaciones
```typescript
// Antes (sigue funcionando)
import { TransaccionesService } from '@/modules/transacciones';

// Después (nuevo, más específico)
import { ItemsService } from '@/modules/transacciones/services';
```

### 3. Inyección de Dependencias
```typescript
// Si necesitas un servicio específico:
constructor(private itemsService: ItemsService) {}

// No necesitas: (eso lo maneja el orquestador)
constructor(private transaccionesService: TransaccionesService) {}
```

---

## 🔐 Mejores Prácticas

### ✅ Haz
```typescript
// 1. Usar servicios específicos cuando sea posible
constructor(private items: ItemsService) {}

// 2. Inyectar solo lo que necesitas
constructor(private pagos: PagosService) {}

// 3. Respetar responsabilidades
// Cálculos → CalculosFinancierosService
// Items → ItemsService
// Pagos → PagosService

// 4. Escribir tests aislados
describe('PagosService', () => {
  // Solo testear PagosService
});
```

### ❌ NO Hagas
```typescript
// 1. No hacer todo monolítico
constructor(
  private items: ItemsService,
  private pagos: PagosService,
  private stock: StockService,
  // ...
) {}

// 2. No violar responsabilidades
// No hacer cálculos en ItemsService
// No hacer pagos en CalculosFinancierosService

// 3. No testear todo en un test
describe('MiModulo`, () => {
  // Testear todo junto
});
```

---

## 📞 Preguntas Frecuentes

### P: ¿Dónde agrego un nuevo cálculo?
**R**: En `CalculosFinancierosService.ts`. Ese servicio centraliza toda la lógica matemática.

### P: ¿Cómo actualizo un item?
**R**: Usa `ItemsService.updateSubtotal()` o crea el método que necesites allí.

### P: ¿El controller debe cambiar?
**R**: No. El controller sigue usando `TransaccionesService` como antes.

### P: ¿Puedo acceder directamente a servicios específicos?
**R**: Sí, pero a través de inyección de dependencias en el módulo.

### P: ¿Cómo reporto un bug?
**R**: Identifica en qué servicio está la lógica defectuosa y crea un issue específico.

---

## 🚨 Troubleshooting

### Error: "Cannot find module '...'"
```
Solución: Verificar ruta de importación
import { ItemsService } from './services/items.service';
// ← Asegúrate de que la ruta sea correcta
```

### Error: "Provider not found"
```
Solución: Agregar servicio al módulo
@Module({
  providers: [
    TransaccionesService,
    ItemsService, // ← Agregar aquí
    // ...
  ],
})
```

### Error: "Circular dependency"
```
Solución: Revisar inyecciones en constructor
// No hagas esto:
Items → Extra → Items (círculo)

// En su lugar, usa métodos públicos:
ItemsService → ExtrasService.getExtras()
```

---

## 📈 Progresión de Aprendizaje

### Nivel 1: Principiante
- [ ] Leer `REFACTORIZACION.md`
- [ ] Entender qué hace cada servicio
- [ ] Ver cómo se usan en el controller

### Nivel 2: Intermedio
- [ ] Entender el patrón orquestador
- [ ] Saber dónde agregar funcionalidades
- [ ] Escribir tests básicos

### Nivel 3: Avanzado
- [ ] Contribuir mejoras a servicios
- [ ] Optimizar queries
- [ ] Implementar nuevas features

---

## ✨ Conclusión

La refactorización está diseñada para hacer el código:
- **Más mantenible**: Cambios aislados
- **Más testeable**: Servicios pequeños
- **Más escalable**: Fácil agregar funciones
- **Más comprensible**: Responsabilidades claras

**Bienvenido a la nueva arquitectura** 🎉

---

**Guía actualizada**: Marzo 23, 2026

# 📅 Formato de Fechas - API Restaurante

## 🌍 Configuración de Zona Horaria

La API está configurada para usar la zona horaria de **Bolivia (America/La_Paz)** por defecto.

```typescript
// Configurado en src/main.ts
process.env.TZ = 'America/La_Paz';
```

## 📤 Formato de Entrada (Request)

### Cómo enviar fechas en las peticiones

Cuando envíes fechas al API (POST, PUT, PATCH), puedes usar cualquiera de estos formatos:

#### 1. Formato ISO 8601 (Recomendado)
```json
{
  "fecha": "2026-02-01T21:59:00.000Z"
}
```

#### 2. String de fecha JavaScript
```json
{
  "fecha": "2026-02-01"
}
```

#### 3. Timestamp Unix (milisegundos)
```json
{
  "fecha": 1738444740000
}
```

**Ejemplo real - Crear usuario:**
```bash
POST /usuarios
{
  "nombre": "Juan Pérez",
  "nombre_usuario": "juanperez",
  "contrasena": "Password123!",
  "rol": "cajero"
  // Las fechas creado_en y actualizado_en se generan automáticamente
}
```

## 📥 Formato de Salida (Response)

### Cómo se devuelven las fechas en las respuestas

**Todas las fechas en las respuestas del API se formatean automáticamente** al formato boliviano:

```
HH:mm - dd/MM/yyyy
```

### Ejemplos de formato de salida:

```
21:59 - 01/02/2026
14:30 - 15/03/2026
08:15 - 31/12/2025
```

### Ejemplo de respuesta real:

**GET** `/usuarios`
```json
[
  {
    "id": "usr_abc123def456",
    "nombre": "Juan Pérez",
    "nombre_usuario": "juanperez",
    "rol": "cajero",
    "creado_en": "21:59 - 01/02/2026",
    "actualizado_en": "21:59 - 01/02/2026"
  }
]
```

**GET** `/auth/profile`
```json
{
  "id": "admin-id-0001",
  "nombre": "Administrador",
  "nombre_usuario": "admin",
  "rol": "admin"
}
```

## ⚙️ Implementación Técnica

### Interceptor Global

El formateo automático se implementa mediante un interceptor global:

```typescript
// src/common/interceptors/date-formatter.interceptor.ts
@Injectable()
export class DateFormatterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => transformDates(data)),
    );
  }
}
```

### Función de Transformación

```typescript
// src/common/utils/date-formatter.ts
export function formatBolivianDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(dateObj, 'America/La_Paz');
  return format(zonedDate, "HH:mm - dd/MM/yyyy");
}
```

## 🔄 Transformación Automática

El interceptor **transforma recursivamente** todas las propiedades de tipo `Date` en el objeto de respuesta:

- ✅ Objetos simples
- ✅ Arrays de objetos
- ✅ Objetos anidados
- ✅ Arrays dentro de objetos

**Ejemplo:**
```javascript
// Antes del interceptor (desde la BD)
{
  usuario: {
    nombre: "Juan",
    creado_en: Date('2026-02-01T21:59:00.000Z'),
    pedidos: [
      { fecha: Date('2026-02-02T10:30:00.000Z') }
    ]
  }
}

// Después del interceptor (respuesta al cliente)
{
  usuario: {
    nombre: "Juan",
    creado_en: "21:59 - 01/02/2026",
    pedidos: [
      { fecha: "10:30 - 02/02/2026" }
    ]
  }
}
```

## 📊 Campos de Fecha en la Base de Datos

Todas las tablas incluyen estos campos de auditoría:

```typescript
{
  creado_en: timestamp with timezone,      // Fecha de creación
  actualizado_en: timestamp with timezone, // Última actualización
  borrado_en: timestamp with timezone      // Soft delete (nullable)
}
```

**Características:**
- `with timezone`: Almacena con información de zona horaria
- `defaultNow()`: Valor por defecto es la fecha/hora actual
- `notNull()`: No puede ser nulo (excepto `borrado_en`)

## 🧪 Probando el Formato

### Con Swagger (http://localhost:4000/api)

1. Inicia sesión para obtener un token
2. Haz una petición GET a cualquier endpoint que devuelva fechas
3. Observa que las fechas aparecen en formato `HH:mm - dd/MM/yyyy`

### Con cURL

```bash
# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"admin","contrasena":"Admin123!"}'

# Obtener usuarios (con token)
curl http://localhost:4000/usuarios \
  -H "Authorization: Bearer <TOKEN>"
```

### Respuesta esperada:

```json
[
  {
    "id": "admin-id-0001",
    "nombre": "Administrador",
    "nombre_usuario": "admin",
    "rol": "admin",
    "creado_en": "21:59 - 01/02/2026",
    "actualizado_en": "21:59 - 01/02/2026"
  }
]
```

## 🌐 Para Desarrolladores Frontend

### Consideraciones

1. **No necesitas parsear las fechas**: Ya vienen formateadas como string
2. **Para ordenar**: Convierte el string de vuelta a Date si necesitas ordenamiento
3. **Para editar**: Envía fechas en formato ISO al hacer POST/PUT

### Ejemplo en JavaScript/TypeScript:

```typescript
// Recibir fecha formateada
const usuario = await fetch('/usuarios/123').then(r => r.json());
console.log(usuario.creado_en); // "21:59 - 01/02/2026"

// Para ordenar o comparar, convierte a Date
const parseBolivianDate = (dateStr: string): Date => {
  // "21:59 - 01/02/2026" -> Date object
  const [time, date] = dateStr.split(' - ');
  const [hours, minutes] = time.split(':');
  const [day, month, year] = date.split('/');
  return new Date(+year, +month - 1, +day, +hours, +minutes);
};

// Para enviar (crear/actualizar)
const newUsuario = {
  nombre: "María",
  nombre_usuario: "maria",
  contrasena: "Pass123!",
  rol: "cajero"
  // No envíes creado_en/actualizado_en, se generan automáticamente
};
```

## 📝 Resumen

| Aspecto | Detalles |
|---------|----------|
| **Zona Horaria** | America/La_Paz (Bolivia) |
| **Formato de Entrada** | ISO 8601 / String / Timestamp |
| **Formato de Salida** | `HH:mm - dd/MM/yyyy` |
| **Transformación** | Automática vía interceptor |
| **Librería** | date-fns + date-fns-tz |
| **Scope** | Todas las respuestas del API |

---

**Configurado en:** `src/main.ts`, `src/common/interceptors/date-formatter.interceptor.ts`  
**Documentación técnica:** date-fns, date-fns-tz

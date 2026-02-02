# 👥 Módulo de Gestión de Usuarios

Módulo completo de administración de usuarios implementado con principios SOLID, siguiendo las mejores prácticas de NestJS y Drizzle ORM.

## 🎯 Características

- ✅ CRUD completo (Crear, Leer, Actualizar, Eliminar)
- ✅ Soft delete (eliminación lógica)
- ✅ Hash automático de contraseñas con bcrypt
- ✅ Validación exhaustiva de datos con class-validator
- ✅ Protección con JWT y guards de roles
- ✅ Solo administradores pueden gestionar usuarios
- ✅ IDs únicos generados con nanoid
- ✅ Documentación completa con Swagger
- ✅ Manejo de errores apropiado
- ✅ Principios SOLID aplicados

## 📋 Endpoints Disponibles

Todos los endpoints requieren autenticación JWT y rol de administrador.

### 1. Crear Usuario
**POST** `/usuarios`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "nombre_usuario": "juanperez",
  "contrasena": "Password123!",
  "rol": "cajero"
}
```

**Respuesta (201):**
```json
{
  "id": "usr_abc123def456",
  "nombre": "Juan Pérez",
  "nombre_usuario": "juanperez",
  "rol": "cajero",
  "creado_en": "2026-02-01T00:00:00.000Z",
  "actualizado_en": "2026-02-01T00:00:00.000Z"
}
```

### 2. Listar Usuarios
**GET** `/usuarios`

**Respuesta (200):**
```json
[
  {
    "id": "usr_abc123def456",
    "nombre": "Juan Pérez",
    "nombre_usuario": "juanperez",
    "rol": "cajero",
    "creado_en": "2026-02-01T00:00:00.000Z",
    "actualizado_en": "2026-02-01T00:00:00.000Z"
  }
]
```

### 3. Obtener Usuario por ID
**GET** `/usuarios/:id`

**Respuesta (200):**
```json
{
  "id": "usr_abc123def456",
  "nombre": "Juan Pérez",
  "nombre_usuario": "juanperez",
  "rol": "cajero",
  "creado_en": "2026-02-01T00:00:00.000Z",
  "actualizado_en": "2026-02-01T00:00:00.000Z"
}
```

### 4. Actualizar Usuario
**PUT** `/usuarios/:id`

**Body (todos los campos son opcionales):**
```json
{
  "nombre": "Juan Pérez Actualizado",
  "nombre_usuario": "juanperez2",
  "contrasena": "NewPassword123!",
  "rol": "admin"
}
```

**Respuesta (200):**
```json
{
  "id": "usr_abc123def456",
  "nombre": "Juan Pérez Actualizado",
  "nombre_usuario": "juanperez2",
  "rol": "admin",
  "creado_en": "2026-02-01T00:00:00.000Z",
  "actualizado_en": "2026-02-01T12:00:00.000Z"
}
```

### 5. Eliminar Usuario
**DELETE** `/usuarios/:id`

**Respuesta (204):** Sin contenido

## 🏗️ Arquitectura SOLID

### Single Responsibility Principle (SRP)
- **UsuariosService**: Solo maneja la lógica de negocio de usuarios
- **UsuariosController**: Solo maneja las peticiones HTTP
- **DTOs**: Solo definen y validan estructuras de datos

### Open/Closed Principle (OCP)
- El servicio es extensible mediante herencia
- Los DTOs pueden extenderse sin modificar código existente
- Guards y decoradores son reutilizables

### Liskov Substitution Principle (LSP)
- Las interfaces son consistentes
- Los métodos retornan tipos predecibles

### Interface Segregation Principle (ISP)
- DTOs específicos para crear y actualizar
- Interfaces mínimas y específicas

### Dependency Inversion Principle (DIP)
- Inyección de dependencias con tokens
- Dependencia de abstracciones (interfaces) no de implementaciones

## 🔒 Seguridad

### Hash de Contraseñas
- Bcrypt con 10 salt rounds
- Las contraseñas nunca se retornan en las respuestas
- Hash automático en creación y actualización

### Validaciones

#### Nombre
- Mínimo 3 caracteres
- Máximo 60 caracteres
- Obligatorio al crear

#### Nombre de Usuario
- Mínimo 3 caracteres
- Máximo 30 caracteres
- Solo letras minúsculas, números y guiones bajos
- Único en el sistema
- Obligatorio al crear

#### Contraseña
- Mínimo 6 caracteres
- Hash automático con bcrypt
- Obligatoria al crear, opcional al actualizar

#### Rol
- Solo valores permitidos: `admin` o `cajero`
- Por defecto: `cajero`

### Autorización
- Todos los endpoints requieren autenticación JWT
- Solo usuarios con rol `admin` pueden acceder
- Los guards validan automáticamente

## 📊 Estructura de Archivos

```
src/modules/usuarios/
├── dto/
│   ├── create-usuario.dto.ts    # DTO para crear usuario
│   └── update-usuario.dto.ts    # DTO para actualizar usuario
├── usuarios.controller.ts       # Controlador REST
├── usuarios.service.ts          # Lógica de negocio
└── usuarios.module.ts           # Módulo NestJS
```

## 🧪 Pruebas con Swagger

1. Inicia el servidor: `pnpm start:dev`
2. Abre Swagger: http://localhost:4000/api
3. Autentica como admin:
   - Endpoint: `POST /auth/login`
   - Usuario: `admin`
   - Contraseña: `Admin123!`
4. Copia el token y haz clic en "Authorize"
5. Prueba los endpoints de usuarios

## 🔧 Uso Programático

```typescript
import { UsuariosService } from './modules/usuarios/usuarios.service';

@Injectable()
export class MiServicio {
  constructor(private readonly usuariosService: UsuariosService) {}

  async ejemplo() {
    // Crear usuario
    const usuario = await this.usuariosService.create({
      nombre: 'Pedro García',
      nombre_usuario: 'pedrog',
      contrasena: 'Pass123!',
      rol: 'cajero',
    });

    // Listar usuarios
    const usuarios = await this.usuariosService.findAll();

    // Obtener uno
    const uno = await this.usuariosService.findOne('usr_123');

    // Actualizar
    await this.usuariosService.update('usr_123', {
      nombre: 'Pedro García Actualizado',
    });

    // Eliminar (soft delete)
    await this.usuariosService.remove('usr_123');
  }
}
```

## ⚠️ Manejo de Errores

### ConflictException (409)
Se lanza cuando se intenta usar un `nombre_usuario` ya existente.

### NotFoundException (404)
Se lanza cuando se intenta acceder/actualizar/eliminar un usuario inexistente.

### ValidationException (400)
Se lanza cuando los datos no cumplen con las validaciones de los DTOs.

### UnauthorizedException (401)
Se lanza cuando no se proporciona un token válido.

### ForbiddenException (403)
Se lanza cuando el usuario no tiene el rol requerido (admin).
✅ Módulo de Gestión de Usuarios Implementado Exitosamente

🎉 Resumen de Implementación
He creado un módulo completo de gestión de usuarios para producción, siguiendo principios SOLID:

📁 Archivos Creados
DTOs (Data Transfer Objects)

create-usuario.dto.ts - Validación para crear
update-usuario.dto.ts - Validación para actualizar
Servicio

usuarios.service.ts - Lógica CRUD completa
Controlador

usuarios.controller.ts - 5 endpoints REST
Módulo

usuarios.module.ts - Configuración NestJS
Documentación

USUARIOS_MODULE.md - Guía completa
🔐 Características de Seguridad
Autenticación JWT obligatoria en todos los endpoints
Solo admins pueden gestionar usuarios
Hash bcrypt automático de contraseñas
Soft delete (no se eliminan físicamente)
Validación exhaustiva con class-validator
IDs únicos con nanoid
🎯 Principios SOLID Aplicados
Single Responsibility: Cada clase una responsabilidad
Open/Closed: Extensible sin modificar
Liskov Substitution: Tipos consistentes
Interface Segregation: DTOs específicos
Dependency Inversion: Inyección de dependencias
📡 Endpoints
Método	Ruta	Descripción
POST	/usuarios	Crear usuario
GET	/usuarios	Listar usuarios
GET	/usuarios/:id	Obtener por ID
PUT	/usuarios/:id	Actualizar
DELETE	/usuarios/:id	Eliminar (soft)
✅ Estado
✅ Compilación exitosa
✅ Sin errores de TypeScript
✅ Documentación Swagger completa
✅ Listo para producción
🚀 Próximo Paso
Inicia el servidor con pnpm start:dev y prueba en http://localhost:4000/api
## 🚀 Mejoras Futuras Recomendadas

- [ ] Paginación para listado de usuarios
- [ ] Filtros y búsqueda
- [ ] Historial de cambios (auditoría)
- [ ] Exportación a CSV/Excel
- [ ] Cambio de contraseña por el propio usuario
- [ ] Recuperación de contraseña
- [ ] Verificación de email
- [ ] Bloqueo temporal de cuentas
- [ ] Últimas sesiones activas

## 📖 Referencias

- [NestJS Guards](https://docs.nestjs.com/guards)
- [Class Validator](https://github.com/typestack/class-validator)
- [Drizzle ORM](https://orm.drizzle.team/)
- [nanoid](https://github.com/ai/nanoid)

---

**Implementado por:** Arquitecto de Software Senior  
**Stack:** NestJS + Drizzle ORM + PostgreSQL + JWT  
**Principios:** SOLID, Clean Code, Security Best Practices

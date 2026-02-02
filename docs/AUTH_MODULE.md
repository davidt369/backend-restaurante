# 🔐 Módulo de Autenticación - API Restaurante

Módulo completo de autenticación JWT implementado con NestJS, Drizzle ORM y Passport.

## 📋 Características

- ✅ Autenticación con JWT (JSON Web Tokens)
- ✅ Estrategia Local (usuario/contraseña)
- ✅ Estrategia JWT para proteger rutas
- ✅ Hash de contraseñas con bcrypt
- ✅ Validación de DTOs con class-validator
- ✅ Documentación completa con Swagger
- ✅ Soporte para roles (admin, cajero)
- ✅ Soft delete (usuarios no se eliminan físicamente)

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` basándote en `.env.example`:

```bash
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/restaurante
JWT_SECRET=tu-secreto-super-seguro-cambialo-en-produccion
JWT_EXPIRATION=24h
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Preparar Base de Datos

```bash
# Resetear y crear el esquema
pnpm db:fresh

# O ejecutar por pasos:
pnpm db:reset    # Elimina todo
pnpm db:generate # Genera migraciones
pnpm db:migrate  # Aplica migraciones
pnpm db:seed     # Crea usuarios de prueba
```

## 👥 Usuarios de Prueba

Después de ejecutar `pnpm db:seed`, tendrás estos usuarios:

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | Admin123! | admin |
| cajero1 | Cajero123! | cajero |

## 📚 Documentación API (Swagger)

### Iniciar el servidor

```bash
pnpm start:dev
```

### Acceder a Swagger

Abre tu navegador en: **http://localhost:4000/api**

## 🔑 Cómo Usar la Autenticación

### 1. Login (Obtener Token)

**Endpoint:** `POST /auth/login`

**Body:**
```json
{
  "nombre_usuario": "admin",
  "contrasena": "Admin123!"
}
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "admin-id-0001",
    "nombre": "Administrador",
    "nombre_usuario": "admin",
    "rol": "admin"
  }
}
```

### 2. Usar el Token en Swagger

1. Copia el `access_token` de la respuesta del login
2. Haz clic en el botón **"Authorize"** (🔓) en la parte superior de Swagger
3. Pega el token en el campo (sin el prefijo "Bearer")
4. Haz clic en **"Authorize"** y luego **"Close"**

Ahora puedes hacer peticiones a endpoints protegidos.

### 3. Obtener Perfil del Usuario

**Endpoint:** `GET /auth/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Respuesta:**
```json
{
  "id": "admin-id-0001",
  "nombre": "Administrador",
  "nombre_usuario": "admin",
  "rol": "admin"
}
```

## 🏗️ Arquitectura

### Estructura de Archivos

```
src/modules/auth/
├── dto/
│   └── login.dto.ts              # DTO de validación para login
├── strategies/
│   ├── local.strategy.ts         # Estrategia Passport Local
│   └── jwt.strategy.ts           # Estrategia Passport JWT
├── auth.controller.ts            # Controlador con endpoints
├── auth.service.ts               # Lógica de negocio
└── auth.module.ts                # Módulo NestJS
```

### Flujo de Autenticación

```
1. Usuario → POST /auth/login (nombre_usuario, contrasena)
2. LocalStrategy → Valida credenciales con bcrypt
3. AuthService → Genera JWT con payload (id, nombre_usuario, rol)
4. Cliente recibe → { access_token, usuario }
5. Cliente → Envía token en header: Authorization: Bearer <token>
6. JwtStrategy → Valida token y extrae payload
7. Guard → Permite/Deniega acceso al endpoint
```

## 🔒 Seguridad

### Principios Implementados

- **Hash de Contraseñas:** bcrypt con 10 salt rounds
- **JWT Secreto:** Configurable vía variable de entorno
- **Expiración de Tokens:** Configurable (default: 24h)
- **Validación de DTOs:** Whitelist habilitado, rechaza propiedades desconocidas
- **Soft Delete:** Usuarios eliminados no pueden autenticarse
- **Roles en JWT:** Preparado para guards de autorización

### Próximas Mejoras Recomendadas

- [ ] Refresh tokens
- [ ] Rate limiting (throttler)
- [ ] Guards de roles (@Roles('admin'))
- [ ] 2FA (Two-Factor Authentication)
- [ ] Blacklist de tokens
- [ ] Logs de auditoría

## 🛠️ Uso en Otros Módulos

### Proteger un Endpoint

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('productos')
export class ProductosController {
  
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  async listar() {
    // Solo usuarios autenticados pueden acceder
    return [];
  }
}
```

### Obtener Usuario Actual

```typescript
import { Request } from '@nestjs/common';

@Get('mi-recurso')
@UseGuards(AuthGuard('jwt'))
async miRecurso(@Request() req) {
  const usuario = req.user; // { id, nombre_usuario, rol }
  console.log(usuario.rol); // 'admin' o 'cajero'
  return { mensaje: `Hola ${usuario.nombre_usuario}` };
}
```

## 🧪 Testing

### Probar con cURL

```bash
# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"admin","contrasena":"Admin123!"}'

# Profile (reemplaza <TOKEN> con el token obtenido)
curl http://localhost:4000/auth/profile \
  -H "Authorization: Bearer <TOKEN>"
```

## 📝 Notas Técnicas

- **Drizzle ORM:** Usa token de inyección `DRIZZLE_DB`
- **Mapeo de Campos:** `nombre_usuario` y `contrasena` (no username/password)
- **Payload JWT:** Incluye `sub` (id), `nombre_usuario` y `rol`
- **ConfigService:** Maneja secretos y configuración
- **Validación Global:** Habilitada en `main.ts`

## 📖 Referencias

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Passport JWT](http://www.passportjs.org/packages/passport-jwt/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Swagger/OpenAPI](https://docs.nestjs.com/openapi/introduction)

---

**Autor:** Arquitecto de Software Senior  
**Stack:** NestJS + Drizzle ORM + PostgreSQL + JWT

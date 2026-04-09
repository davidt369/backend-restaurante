# Restaurante API

API principal del sistema Restaurante V2. Este backend concentra la logica de negocio, la autenticacion, el control de roles, la gestion de caja, las transacciones, el inventario y el panel de indicadores.

## Que resuelve este backend

El objetivo de esta API es ordenar la operacion diaria del restaurante en un solo punto central.

- Controla el acceso de usuarios con JWT.
- Registra apertura, cierre y resumen de caja.
- Gestiona ventas, pagos, items y extras.
- Mantiene catalogos de productos, ingredientes y platos.
- Permite consultar indicadores del negocio desde el dashboard.
- Guarda la informacion en PostgreSQL con trazabilidad por usuario y fecha.

## Arquitectura general

El backend esta construido con una arquitectura modular sobre NestJS.

- `Auth`: inicio de sesion, perfil y control de acceso.
- `Usuarios`: administracion de cuentas y roles.
- `Caja`: apertura, gastos, resumen, cierre e historial.
- `Productos`: catalogo de productos de venta.
- `Ingredientes`: control de insumos y cantidades.
- `Platos`: gestion del menu y recetas.
- `Transacciones`: pedidos, detalle de items, extras y pagos.
- `Dashboard`: metricas y resumen operativo.

### Flujo general de funcionamiento

1. El usuario inicia sesion con nombre de usuario y contrasena.
2. La API valida las credenciales y devuelve un token JWT.
3. El frontend envia ese token en cada solicitud protegida.
4. La API verifica el token y el rol antes de ejecutar la accion.
5. La informacion se guarda en PostgreSQL y queda disponible para consulta.

## Stack tecnologico

- NestJS 11
- PostgreSQL 17
- Drizzle ORM
- JWT con Passport
- Swagger para documentacion de la API
- Docker y Docker Compose para ejecucion local reproducible

## Requisitos previos

Antes de ejecutar el proyecto necesitas:

- Node.js 22 o superior.
- Docker y Docker Compose instalados.
- Acceso a un servidor PostgreSQL si no usas Docker.
- Un archivo `.env` con las variables del backend.

## Instalacion y arranque rapido

### Opcion recomendada: Docker

Desde la carpeta `api-backend`:

```bash
npm run dev
```

Este comando levanta el contenedor de base de datos y la API en un solo paso.

### Opcion con setup guiado

```bash
npm run setup
```

### Inicio manual en desarrollo

```bash
npm install
npm run start:dev
```

## Variables de entorno

Revisa el archivo `.env` del proyecto. Las variables mas importantes suelen ser:

- `DATABASE_URL`: conexion a PostgreSQL.
- `JWT_SECRET`: clave para firmar tokens.
- `PORT`: puerto de la API.
- `NODE_ENV`: entorno de ejecucion.

Si trabajas con Docker, la base de datos suele quedar disponible en `localhost:5435` y la API en `http://localhost:3000`.

## Comandos utiles

### Desarrollo y Docker

```bash
npm run dev
npm run down
npm run docker:logs
npm run docker:destroy
npm run docker:shell
```

### Base de datos

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:fresh
npm run db:reset
npm run db:studio
```

### Ejecucion local

```bash
npm run start
npm run start:dev
npm run start:prod
```

### Calidad y pruebas

```bash
npm run lint
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Endpoints principales

La API usa el prefijo global `/api`.

### Autenticacion

- `POST /api/auth/login`: inicia sesion.
- `GET /api/auth/profile`: devuelve el perfil autenticado.
- `GET /api/auth/test-admin`: endpoint de prueba para validar roles.

### Caja

- `POST /api/caja/abrir`: abre caja.
- `GET /api/caja/actual`: consulta la caja activa.
- `POST /api/caja/gastos`: registra un gasto.
- `GET /api/caja/resumen`: calcula el resumen previo al cierre.
- `POST /api/caja/cerrar`: cierra la caja.
- `GET /api/caja/historial`: lista las cajas cerradas.

### Dashboard

- `GET /api/dashboard/stats`: devuelve indicadores operativos y graficos.

## Funcionamiento por modulo

### Auth

El modulo de autenticacion valida el nombre de usuario y la contrasena, genera un token JWT y entrega los datos basicos del usuario para que el frontend sepa que permisos aplicar.

### Usuarios

Permite administrar cuentas del sistema y separar responsabilidades entre administradores y cajeros.

### Caja

Este modulo cubre el flujo mas sensible del negocio:

- apertura de turno,
- registro de gastos,
- consulta de caja activa,
- calculo de resumen,
- cierre con diferencia,
- historial de turnos.

### Inventario y catalogos

Productos, ingredientes y platos funcionan como la base del menu y del control operativo. Esto permite que la venta no sea solo un registro de dinero, sino tambien una actualizacion del estado real del negocio.

### Transacciones

Registra lo que el cliente consumio, los extras solicitados y la forma de pago utilizada. Esto ayuda a evitar ventas incompletas y facilita la conciliacion al cierre.

### Dashboard

Presenta una lectura rapida del periodo seleccionado: ventas, gastos, ganancia neta, actividad reciente y graficos de comportamiento diario.

## Seguridad y acceso

La API protege los endpoints con:

- JWT para autenticar peticiones.
- Roles para limitar acceso a funciones sensibles.
- Validacion global de datos para rechazar entradas invalidas.
- CORS configurado para los orígenes permitidos.

## Documentacion de la API

Swagger esta disponible en:

```bash
http://localhost:3000/api
```

Desde alli puedes revisar rutas, parametros, ejemplos y autorizarte con el token JWT.

## Pruebas

El backend cuenta con pruebas de:

- servicios,
- controladores,
- integracion,
- pruebas end-to-end.

Comandos recomendados:

```bash
npm run test
npm run test:e2e
npm run test:cov
```

## Despliegue y ejecucion estable

Para desarrollo local y pruebas de equipo, la forma mas confiable de arrancar el sistema es Docker Compose. Esto evita diferencias entre estaciones de trabajo y asegura que la base de datos y la API levanten con la misma configuracion.

## Estructura general del proyecto

- `src/main.ts`: arranque de la aplicacion y configuracion global.
- `src/app.module.ts`: composicion de modulos.
- `src/db/schema.ts`: modelo de datos.
- `src/modules/*`: modulos de negocio.
- `test/*`: pruebas end-to-end.

## Flujo operativo recomendado

1. Ejecutar migraciones y seed.
2. Levantar la API.
3. Iniciar el frontend.
4. Iniciar sesion con un usuario de prueba.
5. Abrir caja y registrar una venta.
6. Revisar resumen y cerrar turno.

## Usuarios de prueba

Si el seed ya fue cargado, normalmente existen usuarios de ejemplo para validar el sistema desde el frontend. Consulta el seed o la documentacion interna del proyecto para confirmar credenciales activas.

## Problemas frecuentes

### La API no conecta con la base de datos

- Verifica `DATABASE_URL`.
- Confirma que PostgreSQL este corriendo.
- Revisa logs con `npm run docker:logs`.

### Swagger no carga

- Confirma que la API este ejecutandose.
- Revisa que el puerto configurado sea el correcto.
- Verifica que el prefijo `/api` no este duplicado en la URL.

### El login falla aunque las credenciales sean correctas

- Revisa que el seed de usuarios se haya ejecutado.
- Verifica que la contrasena corresponda al ambiente actual.
- Confirma que el usuario no este marcado como borrado.

## Recursos relacionados

- Documentacion tecnica del proyecto.
- Manual del frontend.
- Resultados de pruebas.
- Guia de despliegue con Docker.<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">🍽️ Restaurante API</h1>

<p align="center">
  <strong>NestJS + PostgreSQL 17 + Drizzle ORM</strong>
</p>

---

## 🚀 Setup Rápido para Nuevos Desarrolladores

> **¿Es tu primer día?** Ejecuta esto y el proyecto estará 100% listo en 5 minutos.

### Windows:
```powershell
.\setup.ps1
```

### Linux/Mac:
```bash
bash setup.sh
```

### Cualquier Sistema (Recomendado):
```bash
npm run setup
```

**↳ Lee [TEAM_ONBOARDING.md](./TEAM_ONBOARDING.md) para instrucciones detalladas**

---

## ⚡ Inicios Posteriores

```bash
# Levanta TODO (PostgreSQL + NestJS) con un comando:
npm run dev

# Ver en terminal:
# 🚀 SERVER RUNNING SUCCESSFULLY
# 📍 API: http://localhost:3000
# 📚 Swagger: http://localhost:3000/api
```

---

## 📚 Guías Importantes

| Documento | Para Quién | Contenido |
|-----------|-----------|----------|
| **[TEAM_ONBOARDING.md](./TEAM_ONBOARDING.md)** | 👤 Nuevos devs | Guía de 5 min para primer setup |
| **[SETUP.md](./SETUP.md)** | 👥 Equipo completo | Setup completo + troubleshooting |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | 💻 Desarrolladores | Arquitectura y estructura del código |
| **[SETUP_SUMMARY.md](./SETUP_SUMMARY.md)** | 📋 Referencia | Qué se automatizó y por qué |

---

## 🔥 Otros Comandos Útiles

```bash
# Base de Datos
npm run db:migrate         # Ejecutar migraciones
npm run db:seed            # Cargar datos iniciales
npm run db:fresh           # Reset + Migrate + Seed
npm run db:reset           # Limpiar toda la DB

# Docker
npm run dev                # Levantar TODO
npm run down               # Detener contenedores
npm run docker:destroy     # Eliminar volumen de datos
npm run docker:logs        # Ver logs en tiempo real
npm run docker:shell       # Acceder a bash del contenedor

# Testing
npm run test               # Ejecutar tests
npm run test:e2e          # Ejecutar tests end-to-end
```

---

## 📖 Stack Tecnológico

- **Framework**: NestJS 11
- **Base de Datos**: PostgreSQL 17
- **ORM**: Drizzle ORM
- **Auth**: JWT (Passport)
- **Container**: Docker + Docker Compose
- **Node.js**: 22 LTS

---



[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

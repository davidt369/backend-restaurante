import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DateFormatterInterceptor } from './common/interceptors/date-formatter.interceptor';

// ⏰ Configurar zona horaria para todo el proyecto (Bolivia)
process.env.TZ = 'America/La_Paz';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 📅 Interceptor global para formatear fechas
  app.useGlobalInterceptors(new DateFormatterInterceptor());

  // 🌐 Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // 🌐 CORS
  const allowedOrigins = [
    'http://localhost:5173',
    'https://young-waterfall-2598.maroger369.workers.dev',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Configurar pipes de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades adicionales
      transform: true, // Transforma los tipos automáticamente
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('API Restaurante')
    .setDescription('API REST para el sistema de gestión de restaurante')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      'JWT-auth', // Este nombre se usa en @ApiBearerAuth()
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token en localStorage
    },
  });
  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`📚 Swagger en http://localhost:${port}/api`);
}
void bootstrap();

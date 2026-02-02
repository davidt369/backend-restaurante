import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // Configurar zona horaria del proceso Node.js a Bolivia
  process.env.TZ = 'America/La_Paz';

  // 🌐 CORS
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

  app.enableCors({
    origin: frontendUrl,
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
  const port = configService.get<number>('PORT') ?? 4000;

  await app.listen(4000);
  console.log(`🚀 Servidor corriendo en http://localhost:${port}/api/`);
  console.log(`📚 Swagger en http://localhost:${port}/api/v1/docs`);
}
void bootstrap();

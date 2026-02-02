import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import * as authService from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: authService.AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica un usuario con nombre_usuario y contraseña, retornando un token JWT',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'usr_1234567890' },
            nombre: { type: 'string', example: 'David Tola' },
            nombre_usuario: { type: 'string', example: 'davidtola' },
            rol: { type: 'string', example: 'admin' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas',
  })
  async login(@Request() req: any) {
    // El usuario ya está validado por el LocalStrategy
    return this.authService.login(req.user as authService.Usuario);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener perfil del usuario',
    description:
      'Retorna la información del usuario autenticado mediante el token JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'usr_1234567890' },
        nombre: { type: 'string', example: 'David Tola' },
        nombre_usuario: { type: 'string', example: 'davidtola' },
        rol: { type: 'string', example: 'admin' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token inválido o expirado',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    // Usa el decorador @CurrentUser para obtener el ID del usuario
    return this.authService.getProfile(userId);
  }

  @Get('test-admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '[DEMO] Endpoint solo para admins',
    description:
      'Endpoint de ejemplo que demuestra el uso del guard de roles. Solo usuarios con rol "admin" pueden acceder.',
  })
  @ApiResponse({
    status: 200,
    description: 'Acceso permitido',
    schema: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', example: 'Hola admin, tienes acceso!' },
        usuario: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nombre_usuario: { type: 'string' },
            rol: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - No tienes el rol requerido',
  })
  testAdmin(@CurrentUser() usuario: authService.Usuario) {
    return {
      mensaje: 'Hola admin, tienes acceso!',
      usuario,
    };
  }
}

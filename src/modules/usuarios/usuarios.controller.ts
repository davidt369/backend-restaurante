import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Usuarios')
@Controller('usuarios')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Crea un nuevo usuario en el sistema. Solo administradores pueden crear usuarios.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'usr_abc123def456' },
        nombre: { type: 'string', example: 'Juan Pérez' },
        nombre_usuario: { type: 'string', example: 'juanperez' },
        rol: { type: 'string', example: 'cajero' },
        creado_en: { type: 'string', format: 'date-time' },
        actualizado_en: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'El nombre de usuario ya está en uso',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol admin',
  })
  async create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar todos los usuarios',
    description:
      'Obtiene la lista de todos los usuarios activos del sistema. Solo administradores pueden ver la lista.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'usr_abc123def456' },
          nombre: { type: 'string', example: 'Juan Pérez' },
          nombre_usuario: { type: 'string', example: 'juanperez' },
          rol: { type: 'string', example: 'cajero' },
          creado_en: { type: 'string', format: 'date-time' },
          actualizado_en: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol admin',
  })
  async findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description:
      'Obtiene la información de un usuario específico. Solo administradores pueden ver detalles de usuarios.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 'usr_abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'usr_abc123def456' },
        nombre: { type: 'string', example: 'Juan Pérez' },
        nombre_usuario: { type: 'string', example: 'juanperez' },
        rol: { type: 'string', example: 'cajero' },
        creado_en: { type: 'string', format: 'date-time' },
        actualizado_en: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol admin',
  })
  async findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Actualizar usuario',
    description:
      'Actualiza la información de un usuario existente. Solo administradores pueden actualizar usuarios.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 'usr_abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'usr_abc123def456' },
        nombre: { type: 'string', example: 'Juan Pérez Actualizado' },
        nombre_usuario: { type: 'string', example: 'juanperez2' },
        rol: { type: 'string', example: 'admin' },
        creado_en: { type: 'string', format: 'date-time' },
        actualizado_en: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'El nombre de usuario ya está en uso',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol admin',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar usuario',
    description:
      'Elimina un usuario del sistema (soft delete). Solo administradores pueden eliminar usuarios.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 'usr_abc123def456',
  })
  @ApiResponse({
    status: 204,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol admin',
  })
  async remove(@Param('id') id: string) {
    await this.usuariosService.remove(id);
  }
}

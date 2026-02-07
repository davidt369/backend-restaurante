import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PlatosService } from './platos.service';
import { CreatePlatoDto } from './dto/create-plato.dto';
import { UpdatePlatoDto } from './dto/update-plato.dto';
import { AddIngredienteDto } from './dto/add-ingrediente.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Platos')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('platos')
export class PlatosController {
  constructor(private readonly platosService: PlatosService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un nuevo plato' })
  @ApiResponse({
    status: 201,
    description: 'Plato creado exitosamente',
  })
  create(@Body() createPlatoDto: CreatePlatoDto) {
    return this.platosService.create(createPlatoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los platos activos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de platos',
  })
  findAll() {
    return this.platosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un plato por ID' })
  @ApiResponse({
    status: 200,
    description: 'Plato encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Plato no encontrado',
  })
  findOne(@Param('id') id: string) {
    return this.platosService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un plato' })
  @ApiResponse({
    status: 200,
    description: 'Plato actualizado exitosamente',
  })
  update(@Param('id') id: string, @Body() updatePlatoDto: UpdatePlatoDto) {
    return this.platosService.update(id, updatePlatoDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar un plato (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Plato eliminado exitosamente',
  })
  remove(@Param('id') id: string) {
    return this.platosService.remove(id);
  }

  // Gestión de ingredientes
  @Post(':id/ingredientes')
  @Roles('admin')
  @ApiOperation({ summary: 'Agregar un ingrediente a un plato' })
  @ApiResponse({
    status: 201,
    description: 'Ingrediente agregado al plato',
  })
  addIngrediente(
    @Param('id') id: string,
    @Body() addIngredienteDto: AddIngredienteDto,
  ) {
    return this.platosService.addIngrediente(id, addIngredienteDto);
  }

  @Get(':id/ingredientes')
  @ApiOperation({ summary: 'Obtener ingredientes de un plato' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ingredientes del plato',
  })
  getIngredientes(@Param('id') id: string) {
    return this.platosService.getIngredientes(id);
  }

  @Delete(':id/ingredientes/:ingredienteId')
  @Roles('admin')
  @ApiOperation({ summary: 'Remover un ingrediente de un plato' })
  @ApiResponse({
    status: 200,
    description: 'Ingrediente removido del plato',
  })
  removeIngrediente(
    @Param('id') id: string,
    @Param('ingredienteId') ingredienteId: string,
  ) {
    return this.platosService.removeIngrediente(id, ingredienteId);
  }
}

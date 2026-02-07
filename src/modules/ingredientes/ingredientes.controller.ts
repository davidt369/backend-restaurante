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
import { IngredientesService } from './ingredientes.service';
import { CreateIngredienteDto } from './dto/create-ingrediente.dto';
import { UpdateIngredienteDto } from './dto/update-ingrediente.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Ingredientes')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ingredientes')
export class IngredientesController {
  constructor(private readonly ingredientesService: IngredientesService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un nuevo ingrediente' })
  @ApiResponse({
    status: 201,
    description: 'Ingrediente creado exitosamente',
  })
  create(@Body() createIngredienteDto: CreateIngredienteDto) {
    return this.ingredientesService.create(createIngredienteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los ingredientes activos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ingredientes',
  })
  findAll() {
    return this.ingredientesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un ingrediente por ID' })
  @ApiResponse({
    status: 200,
    description: 'Ingrediente encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Ingrediente no encontrado',
  })
  findOne(@Param('id') id: string) {
    return this.ingredientesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un ingrediente' })
  @ApiResponse({
    status: 200,
    description: 'Ingrediente actualizado exitosamente',
  })
  update(
    @Param('id') id: string,
    @Body() updateIngredienteDto: UpdateIngredienteDto,
  ) {
    return this.ingredientesService.update(id, updateIngredienteDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar un ingrediente (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Ingrediente eliminado exitosamente',
  })
  remove(@Param('id') id: string) {
    return this.ingredientesService.remove(id);
  }
}

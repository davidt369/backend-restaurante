import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TransaccionesService } from './transacciones.service';
import { CreateTransaccionDto } from './dto/create-transaccion.dto';
import { UpdateTransaccionDto } from './dto/update-transaccion.dto';
import { AddItemDto } from './dto/add-item.dto';
import { AddExtraDto } from './dto/add-extra.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Transacciones')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('transacciones')
export class TransaccionesController {
  constructor(private readonly transaccionesService: TransaccionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva transacción (pedido)' })
  @ApiResponse({
    status: 201,
    description: 'Transacción creada exitosamente',
  })
  create(@Body() createTransaccionDto: CreateTransaccionDto, @Request() req) {
    return this.transaccionesService.create(createTransaccionDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las transacciones activas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones',
  })
  findAll() {
    return this.transaccionesService.findAll();
  }

  // ========== VISTA DE COCINA ==========

  @Get('cocina/pendientes')
  @ApiOperation({ summary: 'Obtener pedidos pendientes para cocina' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos pendientes para cocina',
  })
  getPendientesCocina() {
    return this.transaccionesService.findPendientesCocina();
  }

  @Patch(':id/cocina/completar')
  @ApiOperation({ summary: 'Marcar pedido de cocina como terminado' })
  @ApiResponse({
    status: 200,
    description: 'Pedido marcado como terminado',
  })
  @ApiParam({ name: 'id', type: 'number' })
  completarOrdenCocina(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.completarOrdenCocina(id);
  }

  // =====================================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una transacción por ID' })
  @ApiResponse({
    status: 200,
    description: 'Transacción encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  @ApiParam({ name: 'id', type: 'number' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción actualizada exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTransaccionDto: UpdateTransaccionDto,
  ) {
    return this.transaccionesService.update(id, updateTransaccionDto);
  }

  @Delete(':id')
  @Roles('admin', 'cajero')
  @ApiOperation({ summary: 'Eliminar una transacción (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Transacción eliminada exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.remove(id);
  }

  @Post(':id/reabrir')
  @ApiOperation({
    summary: 'Reabrir una transacción cerrada para agregar más items',
    description:
      'Permite reabrir una transacción cerrada cuando el cliente pide más. ' +
      'Mantiene el monto_pagado para no cobrar lo ya pagado. Solo se cobra el nuevo monto_pendiente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transacción reabierta exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  reabrirTransaccion(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.reabrirTransaccion(id);
  }

  @Get('caja/:cajaId')
  @ApiOperation({ summary: 'Obtener transacciones de una caja específica' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones de la caja',
  })
  @ApiParam({ name: 'cajaId', type: 'number' })
  getTransaccionesPorCaja(@Param('cajaId', ParseIntPipe) cajaId: number) {
    return this.transaccionesService.findByCaja(cajaId);
  }

  @Get('caja/:cajaId/resumen')
  @ApiOperation({ summary: 'Obtener resumen de items vendidos por caja' })
  @ApiParam({ name: 'cajaId', type: 'number' })
  getResumenItemsPorCaja(@Param('cajaId', ParseIntPipe) cajaId: number) {
    return this.transaccionesService.getResumenItemsPorCaja(cajaId);
  }

  // ========== GESTIÓN DE ITEMS ==========

  @Post(':id/items')
  @ApiOperation({
    summary: 'Agregar un item (producto o plato) a la transacción',
  })
  @ApiResponse({
    status: 201,
    description: 'Item agregado exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() addItemDto: AddItemDto,
  ) {
    return this.transaccionesService.addItem(id, addItemDto);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Obtener todos los items de una transacción' })
  @ApiResponse({
    status: 200,
    description: 'Lista de items',
  })
  @ApiParam({ name: 'id', type: 'number' })
  getItems(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.getItems(id);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Eliminar un item de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Item eliminado exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiParam({ name: 'itemId', type: 'number' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.transaccionesService.removeItem(id, itemId);
  }

  // ========== GESTIÓN DE EXTRAS ==========

  @Post(':id/items/:itemId/extras')
  @ApiOperation({ summary: 'Agregar un extra a un item' })
  @ApiResponse({
    status: 201,
    description: 'Extra agregado exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiParam({ name: 'itemId', type: 'number' })
  addExtra(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() addExtraDto: AddExtraDto,
  ) {
    return this.transaccionesService.addExtra(id, itemId, addExtraDto);
  }

  @Get(':id/items/:itemId/extras')
  @ApiOperation({ summary: 'Obtener todos los extras de un item' })
  @ApiResponse({
    status: 200,
    description: 'Lista de extras',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiParam({ name: 'itemId', type: 'number' })
  getExtras(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.transaccionesService.getExtras(id, itemId);
  }

  @Delete(':id/items/:itemId/extras/:extraId')
  @ApiOperation({ summary: 'Eliminar un extra de un item' })
  @ApiResponse({
    status: 200,
    description: 'Extra eliminado exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiParam({ name: 'itemId', type: 'number' })
  @ApiParam({ name: 'extraId', type: 'number' })
  removeExtra(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('extraId', ParseIntPipe) extraId: number,
  ) {
    return this.transaccionesService.removeExtra(id, itemId, extraId);
  }

  // ========== GESTIÓN DE PAGOS ==========

  @Post(':id/pagos')
  @ApiOperation({ summary: 'Registrar un pago para la transacción' })
  @ApiResponse({
    status: 201,
    description: 'Pago registrado exitosamente',
  })
  @ApiParam({ name: 'id', type: 'number' })
  addPago(
    @Param('id', ParseIntPipe) id: number,
    @Body() createPagoDto: CreatePagoDto,
    @Request() req,
  ) {
    return this.transaccionesService.addPago(id, createPagoDto, req.user.sub);
  }

  @Get(':id/pagos')
  @ApiOperation({ summary: 'Obtener todos los pagos de una transacción' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pagos',
  })
  @ApiParam({ name: 'id', type: 'number' })
  getPagos(@Param('id', ParseIntPipe) id: number) {
    return this.transaccionesService.getPagos(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AbrirCajaDto, RegistrarGastoDto, CerrarCajaDto } from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CajaService } from './caja.service';

@ApiTags('Caja')
@Controller('caja')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Post('abrir')
  @Roles('admin', 'cajero')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '🟢 Abrir caja del día',
    description:
      'Registra la apertura de caja con el conteo inicial de billetes y monedas. ' +
      'Solo se puede tener una caja abierta a la vez.',
  })
  @ApiResponse({
    status: 201,
    description: 'Caja abierta exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        fecha: { type: 'string', example: '2026-02-04' },
        hora_apertura: { type: 'string', example: '2026-02-04T08:00:00.000Z' },
        usuario_id: { type: 'string', example: 'usr_abc123' },
        monto_inicial: { type: 'number', example: 500.0 },
        b200: { type: 'number', example: 2 },
        b100: { type: 'number', example: 1 },
        cerrada: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una caja abierta',
  })
  async abrirCaja(
    @Body() dto: AbrirCajaDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.cajaService.abrirCaja(dto, user.id);
  }

  @Get('actual')
  @Roles('admin', 'cajero')
  @ApiOperation({
    summary: '📊 Obtener caja actual (abierta)',
    description: 'Devuelve la información de la caja actualmente abierta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Caja actual obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        fecha: { type: 'string' },
        hora_apertura: { type: 'string' },
        usuario_id: { type: 'string' },
        monto_inicial: { type: 'number' },
        ventas_efectivo: { type: 'number' },
        ventas_qr: { type: 'number' },
        total_salidas: { type: 'number' },
        cerrada: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'No hay caja abierta',
    schema: { type: 'null' },
  })
  async obtenerCajaAbierta() {
    return this.cajaService.obtenerCajaAbierta();
  }

  @Post('gastos')
  @Roles('admin', 'cajero')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '💰 Registrar gasto de caja',
    description:
      'Registra un gasto asociado a la caja actual. ' +
      'Si es en efectivo, reduce el dinero físico. Si es QR, no afecta el efectivo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gasto registrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        caja_id: { type: 'number', example: 1 },
        descripcion: { type: 'string', example: 'Compra de gas' },
        metodo_pago: { type: 'string', example: 'efectivo' },
        monto: { type: 'number', example: 50.0 },
        creado_en: { type: 'string', example: '2026-02-04T10:30:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No hay una caja abierta',
  })
  async registrarGasto(
    @Body() dto: RegistrarGastoDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.cajaService.registrarGasto(dto, user.id);
  }

  @Get('resumen')
  @Roles('admin', 'cajero')
  @ApiOperation({
    summary: '📋 Obtener resumen para cierre',
    description:
      'Calcula el resumen de la caja actual mostrando: ' +
      '- Efectivo esperado (inicial + ventas - gastos en efectivo) ' +
      '- Total QR (ventas - gastos en QR) ' +
      '- Total del día',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        caja: { type: 'object' },
        resumen: {
          type: 'object',
          properties: {
            monto_inicial: { type: 'number', example: 500.0 },
            ventas_efectivo: { type: 'number', example: 1200.0 },
            ventas_qr: { type: 'number', example: 800.0 },
            gastos_efectivo: { type: 'number', example: 100.0 },
            gastos_qr: { type: 'number', example: 50.0 },
            efectivo_esperado: { type: 'number', example: 1600.0 },
            total_qr: { type: 'number', example: 750.0 },
            total_del_dia: { type: 'number', example: 2000.0 },
          },
        },
        gastos: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No hay una caja abierta',
  })
  async obtenerResumenCierre() {
    return this.cajaService.obtenerResumenCierre();
  }

  @Get('gastos/historial')
  @Roles('admin', 'cajero')
  @ApiOperation({
    summary: '📉 Obtener historial de gastos',
    description: 'Devuelve una lista con los últimos gastos registrados.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de registros a devolver (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de gastos obtenido exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 10 },
          caja_id: { type: 'number', example: 1 },
          usuario_id: { type: 'string', example: 'usr_123' },
          descripcion: { type: 'string', example: 'Compra de insumos' },
          metodo_pago: { type: 'string', example: 'efectivo' },
          monto: { type: 'number', example: 150.5 },
          creado_en: { type: 'string', example: '2026-02-04T15:30:00.000Z' },
        },
      },
    },
  })
  async obtenerHistorialGastos(@Query('limit') limit?: number) {
    return this.cajaService.obtenerHistorialGastos(limit ?? 50);
  }

  @Post('cerrar')
  @Roles('admin', 'cajero')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔴 Cerrar caja',
    description:
      'Cierra la caja actual comparando el efectivo contado con el esperado. ' +
      'Calcula automáticamente si hay sobrante o faltante.',
  })
  @ApiResponse({
    status: 200,
    description: 'Caja cerrada exitosamente',
    schema: {
      type: 'object',
      properties: {
        caja_id: { type: 'number', example: 1 },
        fecha: { type: 'string', example: '2026-02-04' },
        monto_contado: { type: 'number', example: 1580.0 },
        efectivo_esperado: { type: 'number', example: 1600.0 },
        diferencia: { type: 'number', example: -20.0 },
        estado_diferencia: {
          type: 'string',
          example: 'faltante',
          enum: ['exacto', 'sobrante', 'faltante'],
        },
        resumen_completo: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No hay una caja abierta',
  })
  async cerrarCaja(@Body() dto: CerrarCajaDto) {
    return this.cajaService.cerrarCaja(dto);
  }

  @Get('historial')
  @Roles('admin')
  @ApiOperation({
    summary: '📜 Obtener historial de cajas',
    description: 'Devuelve las últimas cajas cerradas (historial).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número de registros a devolver',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial obtenido exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          fecha: { type: 'string' },
          usuario_id: { type: 'string' },
          monto_inicial: { type: 'number' },
          cerrada: { type: 'boolean' },
        },
      },
    },
  })
  async obtenerHistorial(@Query('limit') limit?: number) {
    return this.cajaService.obtenerHistorial(limit ?? 10);
  }
}

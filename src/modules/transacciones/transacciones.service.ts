import {
  Injectable,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';
import { CajaService } from '../caja/caja.service';
import { CocinaGateway } from './cocina.gateway';
import { CreateTransaccionDto } from './dto/create-transaccion.dto';
import { UpdateTransaccionDto } from './dto/update-transaccion.dto';
import { AddItemDto } from './dto/add-item.dto';
import { AddExtraDto } from './dto/add-extra.dto';
import { CreatePagoDto } from './dto/create-pago.dto';

// Servicios especializados
import { TransaccionesCoreService } from './services/transacciones-core.service';
import { ItemsService } from './services/items.service';
import { ExtrasService } from './services/extras.service';
import { PagosService } from './services/pagos.service';
import { CalculosFinancierosService } from './services/calculos-financieros.service';
import { EstadosTransaccionService } from './services/estados-transaccion.service';
import { CocinaIntegrationService } from './services/cocina-integration.service';
import { StockService } from './services/stock.service';
import { CajaReportesService } from './services/caja-reportes.service';

/**
 * TransaccionesService (ORQUESTADOR)
 * 
 * Este servicio actúa como orquestador, delegando responsabilidades específicas
 * a los servicios especializados.
 * 
 * Servicios especializados:
 * - TransaccionesCoreService: CRUD básico
 * - ItemsService: Gestión de productos/platos en pedidos
 * - ExtrasService: Personalización de items
 * - PagosService: Flujo de dinero
 * - CalculosFinancierosService: Lógica matemática
 * - EstadosTransaccionService: Workflow de estados
 * - CocinaIntegrationService: Integración con cocina
 * - StockService: Control de inventario
 * - CajaReportesService: Reportes y auditoría
 */
@Injectable()
export class TransaccionesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly cajaService: CajaService,
    private readonly cocinaGateway: CocinaGateway,
    
    // Inyectar servicios especializados
    private readonly transaccionesCoreService: TransaccionesCoreService,
    private readonly itemsService: ItemsService,
    private readonly extrasService: ExtrasService,
    private readonly pagosService: PagosService,
    private readonly calculosService: CalculosFinancierosService,
    private readonly estadosService: EstadosTransaccionService,
    private readonly cocinaService: CocinaIntegrationService,
    private readonly stockService: StockService,
    private readonly cajaReportesService: CajaReportesService,
  ) {}


  // ========== GESTIÓN BÁSICA DE TRANSACCIONES (CRUD) ==========

  async create(
    createTransaccionDto: CreateTransaccionDto,
    usuario_id: string,
  ): Promise<any> {
    const transaccion = await this.transaccionesCoreService.create(
      createTransaccionDto,
      usuario_id,
    );

    // Emitir evento de nueva transacción (sin items aún)
    // Solo si tiene mesa o cliente (es un pedido de cocina)
    if (transaccion.mesa || transaccion.cliente) {
      try {
        await this.cocinaService.emitirActualizacionCocina();
      } catch (error) {
        console.error('Error al emitir actualización de cocina:', error);
      }
    }

    return transaccion;
  }

  async findAll(): Promise<any[]> {
    return await this.transaccionesCoreService.findAll();
  }

  async findOne(id: number): Promise<any> {
    return await this.transaccionesCoreService.findOne(id);
  }

  async update(
    id: number,
    updateTransaccionDto: UpdateTransaccionDto,
  ): Promise<any> {
    const transaccion = await this.transaccionesCoreService.update(
      id,
      updateTransaccionDto,
    );

    // Emitir evento de actualización a cocina
    try {
      await this.cocinaService.emitirActualizacionCocina();
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return transaccion;
  }

  async remove(id: number): Promise<{ message: string }> {
    return await this.transaccionesCoreService.remove(id);
  }

  // ========== GESTIÓN DE ITEMS ==========

  async addItem(
    transaccionId: number,
    addItemDto: AddItemDto,
  ): Promise<any> {
    const transaccion = await this.transaccionesCoreService.findOne(transaccionId);

    // Si está cerrada, reabrirla automáticamente
    if (transaccion.estado === 'cerrado') {
      await this.transaccionesCoreService.reabrirTransaccion(transaccionId);
    }

    // Agregar item
    const item = await this.itemsService.addItem(transaccionId, addItemDto);

    // Cargar extras si existen
    if (addItemDto.extras && addItemDto.extras.length > 0) {
      const extrasFormatted = addItemDto.extras.map(e => ({
        ingrediente_id: e.ingrediente_id ? String(e.ingrediente_id) : undefined,
        descripcion: e.descripcion,
        precio: e.precio,
        cantidad: e.cantidad,
      }));
      await this.extrasService.createExtrasFromDto(item.id, extrasFormatted);
      // Recalcular subtotal del item con extras
      await this.recalcularSubtotalItem(item.id);
    }

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

    // Si se agregó un plato, actualizar estado_cocina a pendiente
    if (addItemDto.plato_id) {
      await this.transaccionesCoreService.updateEstadoCocina(
        transaccionId,
        'pendiente',
      );
    }

    // Recalcular estado
    await this.actualizarEstadoTransaccion(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      await this.cocinaService.emitirActualizacionCocina();
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return item;
  }

  async getItems(transaccionId: number): Promise<any[]> {
    await this.transaccionesCoreService.findOne(transaccionId);
    return await this.itemsService.getItems(transaccionId);
  }

  async removeItem(
    transaccionId: number,
    itemId: number,
  ): Promise<{ message: string }> {
    await this.transaccionesCoreService.findOne(transaccionId);
    await this.itemsService.getItem(itemId);

    const resultado = await this.itemsService.removeItem(itemId);

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      await this.cocinaService.emitirActualizacionCocina();
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return resultado;
  }

  // ========== GESTIÓN DE EXTRAS ==========

  async addExtra(
    transaccionId: number,
    itemId: number,
    addExtraDto: AddExtraDto,
  ): Promise<any> {
    await this.transaccionesCoreService.findOne(transaccionId);

    const extra = await this.extrasService.addExtra(itemId, addExtraDto);

    // Recalcular subtotal del item
    await this.recalcularSubtotalItem(itemId);

    // Recalcular monto_total de la transacción
    await this.recalcularMontoTotal(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      await this.cocinaService.emitirActualizacionCocina();
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return extra;
  }

  async getExtras(transaccionId: number, itemId: number): Promise<any[]> {
    await this.transaccionesCoreService.findOne(transaccionId);
    return await this.extrasService.getExtras(itemId);
  }

  async removeExtra(
    transaccionId: number,
    itemId: number,
    extraId: number,
  ): Promise<{ message: string }> {
    await this.transaccionesCoreService.findOne(transaccionId);

    const resultado = await this.extrasService.removeExtra(extraId);

    // Recalcular subtotal del item
    await this.recalcularSubtotalItem(itemId);

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      await this.cocinaService.emitirActualizacionCocina();
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return resultado;
  }

  // ========== GESTIÓN DE PAGOS ==========

  async addPago(
    transaccionId: number,
    createPagoDto: CreatePagoDto,
    usuario_id: string,
  ): Promise<any> {
    const transaccion = await this.transaccionesCoreService.findOne(
      transaccionId,
    );

    const montoTotal = parseFloat(transaccion.monto_total);
    const montoPagado = parseFloat(transaccion.monto_pagado);
    const montoPendiente = montoTotal - montoPagado;

    // Crear pago
    const pago = await this.pagosService.addPago(
      transaccionId,
      createPagoDto,
      usuario_id,
      montoPendiente,
    );

    // Actualizar monto_pagado en transacción
    const nuevoMontoPagado = montoPagado + createPagoDto.monto;
    await this.transaccionesCoreService.updateMontoPagado(
      transaccionId,
      nuevoMontoPagado,
    );

    // Registrar pago en caja
    if (transaccion.caja_id) {
      await this.pagosService.registrarPagoEnCaja(
        transaccion.caja_id,
        createPagoDto.metodo_pago,
        createPagoDto.monto,
      );
    }

    // Recalcular estado
    await this.actualizarEstadoTransaccion(transaccionId);

    return pago;
  }

  async getPagos(transaccionId: number): Promise<any[]> {
    await this.transaccionesCoreService.findOne(transaccionId);
    return await this.pagosService.getPagos(transaccionId);
  }

  // ========== MÉTODOS INTERNOS DE CÁLCULO ==========

  private async recalcularSubtotalItem(itemId: number): Promise<void> {
    const subtotal = await this.calculosService.calcularSubtotalItem(itemId);
    await this.itemsService.updateSubtotal(itemId, subtotal);
  }

  private async recalcularMontoTotal(transaccionId: number): Promise<void> {
    const montoTotal = await this.calculosService.calcularMontoTotal(
      transaccionId,
    );
    await this.transaccionesCoreService.updateMontoTotal(
      transaccionId,
      montoTotal,
    );
  }

  private async actualizarEstadoTransaccion(transaccionId: number): Promise<void> {
    const transaccion = await this.transaccionesCoreService.findOne(
      transaccionId,
    );

    const montoTotal = parseFloat(transaccion.monto_total);
    const montoPagado = parseFloat(transaccion.monto_pagado);
    const montoPendiente = montoTotal - montoPagado;

    const nuevoEstado = await this.estadosService.recalcularEstado(
      transaccionId,
      montoTotal,
      montoPagado,
      transaccion.estado_cocina || null,
    );

    // Solo actualizar si cambió el estado
    if (transaccion.estado !== nuevoEstado) {
      await this.estadosService.updateEstado(transaccionId, nuevoEstado);

      // Si se cierra, descontar stock
      if (nuevoEstado === 'cerrado' && transaccion.estado !== 'cerrado') {
        await this.stockService.descontarStock(transaccionId);
      }
    }
  }

  async reabrirTransaccion(transaccionId: number): Promise<any> {
    return await this.transaccionesCoreService.reabrirTransaccion(
      transaccionId,
    );
  }

  // ========== VISTA DE COCINA ==========

  async findPendientesCocina() {
    return await this.cocinaService.findPendientesCocina();
  }

  async completarOrdenCocina(id: number) {
    const resultado = await this.cocinaService.completarOrdenCocina(id);
    
    // Recalcular estado (puede cerrar si también está pagado)
    await this.actualizarEstadoTransaccion(id);
    
    return resultado;
  }

  // ========== INTEGRACIÓN CON CAJA ==========

  async findByCaja(cajaId: number): Promise<any[]> {
    return await this.transaccionesCoreService.findByCaja(cajaId);
  }

  async getResumenItemsPorCaja(cajaId: number) {
    return await this.cajaReportesService.getResumenItemsPorCaja(cajaId);
  }

  // ========== MÉTODOS PÚBLICOS DE REPORTES ==========

  async getResumenCompletoCaja(cajaId: number) {
    return await this.cajaReportesService.getResumenCompletoCaja(cajaId);
  }

  async generarReporteCajacierre(cajaId: number) {
    return await this.cajaReportesService.generarReporteCierrecaja(cajaId);
  }
}

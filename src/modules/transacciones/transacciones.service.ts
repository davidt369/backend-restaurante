import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { eq, and, isNull, isNotNull, desc, asc, sql, inArray } from 'drizzle-orm';
import { CreateTransaccionDto } from './dto/create-transaccion.dto';
import { UpdateTransaccionDto } from './dto/update-transaccion.dto';
import { AddItemDto } from './dto/add-item.dto';
import { AddExtraDto } from './dto/add-extra.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import type { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';
import { CajaService } from '../caja/caja.service';
import { CocinaGateway } from './cocina.gateway';

type Transaccion = InferSelectModel<typeof schema.transacciones>;
type DetalleItem = InferSelectModel<typeof schema.detalle_items>;
type DetalleItemExtra = InferSelectModel<typeof schema.detalle_item_extras>;
type Pago = InferSelectModel<typeof schema.pagos>;

@Injectable()
export class TransaccionesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly cajaService: CajaService,
    private readonly cocinaGateway: CocinaGateway,
  ) {}

  async create(
    createTransaccionDto: CreateTransaccionDto,
    usuario_id: string,
  ): Promise<any> {
    // Intentar obtener caja abierta (opcional)
    let caja_id = createTransaccionDto.caja_id;

    try {
      const cajaAbierta = await this.cajaService.obtenerCajaAbierta();
      if (cajaAbierta) {
        // Si hay caja abierta y no se proporcionó caja_id, usar la caja abierta
        if (!caja_id) {
          caja_id = cajaAbierta.id;
        }
        // Validar que el caja_id coincida con la caja abierta
        else if (caja_id !== cajaAbierta.id) {
          throw new BadRequestException(
            'El ID de caja no coincide con la caja actualmente abierta.',
          );
        }
      }
    } catch {
      // Si no hay caja abierta, continuar sin caja_id (será null)
      console.warn(
        'No se pudo obtener caja abierta, creando transacción sin caja',
      );
    }

    const [transaccion] = await this.db
      .insert(schema.transacciones)
      .values({
        nro_reg: createTransaccionDto.nro_reg,
        tipo: createTransaccionDto.tipo,
        concepto: createTransaccionDto.concepto,
        mesa: createTransaccionDto.mesa,
        cliente: createTransaccionDto.cliente,
        estado: createTransaccionDto.estado,
        caja_id,
        usuario_id,
        monto_total: '0',
        monto_pagado: '0',
      })
      .returning();

    // Si hay items, agregarlos
    if (createTransaccionDto.items && createTransaccionDto.items.length > 0) {
      // Usamos un bucle para addItem pero con una versión que NO emita a cocina cada vez
      // para evitar el problema de N+1 consultas y emisiones repetitivas
      for (const itemDto of createTransaccionDto.items) {
        await this.addItemLogic(transaccion.id, itemDto);
      }
    }

    // Recalcular montos y estado final una sola vez
    await this.recalcularMontoTotal(transaccion.id);
    await this.recalcularEstado(transaccion.id);

    // Obtener la transacción actualizada corregida
    const transaccionActualizada = await this.findOne(transaccion.id);

    // Emitir evento de nueva transacción UNA SOLA VEZ al final
    if (transaccionActualizada.mesa || transaccionActualizada.cliente) {
      try {
        const pedidosPendientes = await this.findPendientesCocina();
        this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
      } catch (error) {
        console.error('Error al emitir actualización de cocina:', error);
      }
    }

    return transaccionActualizada;
  }

  async findAll(): Promise<any[]> {
    const transacciones = await this.db
      .select()
      .from(schema.transacciones)
      .orderBy(desc(schema.transacciones.creado_en));

    return transacciones.map((t) => ({
      ...t,
      hora: t.hora ? t.hora.toISOString() : null,
      creado_en: t.creado_en ? t.creado_en.toISOString() : null,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
    }));
  }

  async findOne(id: number): Promise<any> {
    const [transaccion] = await this.db
      .select()
      .from(schema.transacciones)
      .where(
        and(
          eq(schema.transacciones.id, id),
          isNull(schema.transacciones.borrado_en),
        ),
      );

    if (!transaccion) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Add calculated monto_pendiente field
    return {
      ...transaccion,
      monto_pendiente: (
        parseFloat(transaccion.monto_total) -
        parseFloat(transaccion.monto_pagado)
      ).toFixed(2),
    };
  }

  async update(
    id: number,
    updateTransaccionDto: UpdateTransaccionDto,
  ): Promise<Transaccion> {
    await this.findOne(id);

    const [transaccionActualizada] = await this.db
      .update(schema.transacciones)
      .set({
        ...updateTransaccionDto,
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, id))
      .returning();

    // Emitir evento de actualización a cocina
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return transaccionActualizada;
  }

  async remove(id: number): Promise<{ message: string }> {
    const transaccion = await this.findOne(id);

    // 1. Revertir pagos de la caja si existen
    const pagosTransaccion = await this.db
      .select()
      .from(schema.pagos)
      .where(
        and(
          eq(schema.pagos.transaccion_id, id),
          isNull(schema.pagos.borrado_en),
        ),
      );

    if (pagosTransaccion.length > 0 && transaccion.caja_id) {
      for (const pago of pagosTransaccion) {
        const monto = parseFloat(pago.monto);
        const metodo = pago.metodo_pago as 'efectivo' | 'qr';

        const [caja] = await this.db
          .select()
          .from(schema.caja_turno)
          .where(eq(schema.caja_turno.id, transaccion.caja_id));

        if (caja) {
          const actualEfectivo = parseFloat(caja.ventas_efectivo || '0');
          const actualQr = parseFloat(caja.ventas_qr || '0');

          if (metodo === 'efectivo') {
            await this.db
              .update(schema.caja_turno)
              .set({
                ventas_efectivo: Math.max(0, actualEfectivo - monto).toFixed(2),
              })
              .where(eq(schema.caja_turno.id, transaccion.caja_id));
          } else if (metodo === 'qr') {
            await this.db
              .update(schema.caja_turno)
              .set({
                ventas_qr: Math.max(0, actualQr - monto).toFixed(2),
              })
              .where(eq(schema.caja_turno.id, transaccion.caja_id));
          }
        }

        // Soft delete del pago
        await this.db
          .update(schema.pagos)
          .set({ borrado_en: new Date() })
          .where(eq(schema.pagos.id, pago.id));
      }
    }

    // 2. Soft delete de items y extras
    const items = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, id),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    for (const item of items) {
      await this.db
        .update(schema.detalle_item_extras)
        .set({ borrado_en: new Date() })
        .where(eq(schema.detalle_item_extras.detalle_item_id, item.id));
    }

    await this.db
      .update(schema.detalle_items)
      .set({ borrado_en: new Date() })
      .where(eq(schema.detalle_items.transaccion_id, id));

    // 3. Soft delete de la transacción
    await this.db
      .update(schema.transacciones)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
        estado: 'anulado',
        estado_cocina: 'anulado',
      })
      .where(eq(schema.transacciones.id, id));

    // 4. Emitir actualización a cocina (CRÍTICO para que desaparezca de la pantalla de cocina)
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error(
        'Error al emitir actualización de cocina tras eliminar:',
        error,
      );
    }

    return {
      message: `Transacción #${transaccion.nro_reg} eliminada exitosamente`,
    };
  }

  // ========== GESTIÓN DE ITEMS ==========

  async addItem(
    transaccionId: number,
    addItemDto: AddItemDto,
  ): Promise<DetalleItem> {
    const item = await this.addItemLogic(transaccionId, addItemDto);

    // Recalcular monto_total y estado para reflejar el cambio individual
    await this.recalcularMontoTotal(transaccionId);
    await this.recalcularEstado(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return item;
  }

  /**
   * Lógica interna para añadir un item sin realizar recalculos globales ni emisiones.
   * Útil para procesamiento por lotes (seeds, creación masiva).
   */
  private async addItemLogic(
    transaccionId: number,
    addItemDto: AddItemDto,
  ): Promise<DetalleItem> {
    const transaccion = await this.findOne(transaccionId);

    // Si está cerrada, reabrirla automáticamente
    if (transaccion.estado === 'cerrado') {
      await this.reabrirTransaccion(transaccionId);
    }

    // Validar que tenga producto_id O plato_id
    if (!addItemDto.producto_id && !addItemDto.plato_id) {
      throw new BadRequestException('Debe proporcionar producto_id o plato_id');
    }

    if (addItemDto.producto_id && addItemDto.plato_id) {
      throw new BadRequestException(
        'No puede proporcionar producto_id y plato_id al mismo tiempo',
      );
    }

    // Obtener precio del producto o plato
    let precio_unitario: string;

    if (addItemDto.producto_id) {
      const [producto] = await this.db
        .select()
        .from(schema.productos)
        .where(
          and(
            eq(schema.productos.id, addItemDto.producto_id),
            isNull(schema.productos.borrado_en),
          ),
        );

      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${addItemDto.producto_id} no encontrado`,
        );
      }

      precio_unitario = producto.precio;
    } else {
      const [plato] = await this.db
        .select()
        .from(schema.platos)
        .where(
          and(
            eq(schema.platos.id, addItemDto.plato_id),
            isNull(schema.platos.borrado_en),
          ),
        );

      if (!plato) {
        throw new NotFoundException(
          `Plato con ID ${addItemDto.plato_id} no encontrado`,
        );
      }

      precio_unitario = plato.precio;
    }
    // Calcular subtotal
    const cantidad = addItemDto.cantidad.toString();
    const subtotal = (
      parseFloat(precio_unitario) * addItemDto.cantidad
    ).toFixed(2);

    // Crear item
    const [item] = await this.db
      .insert(schema.detalle_items)
      .values({
        transaccion_id: transaccionId,
        producto_id: addItemDto.producto_id || null,
        plato_id: addItemDto.plato_id || null,
        cantidad,
        precio_unitario,
        subtotal,
        notas: addItemDto.notas || null,
      })
      .returning();

    // Agregar extras si existen
    if (addItemDto.extras && addItemDto.extras.length > 0) {
      for (const extraDto of addItemDto.extras) {
        if (
          !extraDto.ingrediente_id &&
          !extraDto.descripcion &&
          !extraDto.precio
        ) {
          continue;
        }

        await this.db.insert(schema.detalle_item_extras).values({
          detalle_item_id: item.id,
          ingrediente_id: extraDto.ingrediente_id || null,
          descripcion: extraDto.descripcion || null,
          precio: extraDto.precio.toString(),
          cantidad: extraDto.cantidad?.toString() || '1',
        });
      }

      // Recalcular subtotal del item
      await this.recalcularSubtotalItem(item.id);
    }

    // Si se agregó un plato, actualizar estado_cocina a pendiente
    if (addItemDto.plato_id) {
      await this.db
        .update(schema.transacciones)
        .set({
          estado_cocina: 'pendiente',
          actualizado_en: new Date(),
        })
        .where(eq(schema.transacciones.id, transaccionId));
    }

    return item;
  }

  async getItems(transaccionId: number): Promise<any[]> {
    await this.findOne(transaccionId);

    const items = await this.db
      .select({
        id: schema.detalle_items.id,
        transaccion_id: schema.detalle_items.transaccion_id,
        producto_id: schema.detalle_items.producto_id,
        plato_id: schema.detalle_items.plato_id,
        producto_nombre: schema.productos.nombre,
        plato_nombre: schema.platos.nombre,
        cantidad: schema.detalle_items.cantidad,
        precio_unitario: schema.detalle_items.precio_unitario,
        subtotal: schema.detalle_items.subtotal,
        notas: schema.detalle_items.notas,
      })
      .from(schema.detalle_items)
      .leftJoin(
        schema.productos,
        eq(schema.detalle_items.producto_id, schema.productos.id),
      )
      .leftJoin(
        schema.platos,
        eq(schema.detalle_items.plato_id, schema.platos.id),
      )
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    return items.map((item) => ({
      ...item,
      nombre: item.producto_nombre || item.plato_nombre,
    }));
  }

  async removeItem(
    transaccionId: number,
    itemId: number,
  ): Promise<{ message: string }> {
    await this.findOne(transaccionId);

    const [item] = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.id, itemId),
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    await this.db
      .update(schema.detalle_items)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.detalle_items.id, itemId));

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

    // Recalcular estado
    await this.recalcularEstado(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return { message: 'Item eliminado correctamente' };
  }

  // ========== GESTIÓN DE EXTRAS ==========

  async addExtra(
    transaccionId: number,
    itemId: number,
    addExtraDto: AddExtraDto,
  ): Promise<DetalleItemExtra> {
    await this.findOne(transaccionId);

    // Verificar que el item exista y pertenezca a la transacción
    const [item] = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.id, itemId),
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    // Validar que tenga ingrediente_id O descripcion
    if (!addExtraDto.ingrediente_id && !addExtraDto.descripcion) {
      throw new BadRequestException(
        'Debe proporcionar ingrediente_id o descripcion',
      );
    }

    // Verificar que el ingrediente exista si se proporciona
    if (addExtraDto.ingrediente_id) {
      const [ingrediente] = await this.db
        .select()
        .from(schema.ingredientes)
        .where(
          and(
            eq(schema.ingredientes.id, addExtraDto.ingrediente_id),
            isNull(schema.ingredientes.borrado_en),
          ),
        );

      if (!ingrediente) {
        throw new NotFoundException(
          `Ingrediente con ID ${addExtraDto.ingrediente_id} no encontrado`,
        );
      }
    }

    // Crear extra
    const [extra] = await this.db
      .insert(schema.detalle_item_extras)
      .values({
        detalle_item_id: itemId,
        ingrediente_id: addExtraDto.ingrediente_id || null,
        descripcion: addExtraDto.descripcion || null,
        precio: addExtraDto.precio.toString(),
        cantidad: addExtraDto.cantidad?.toString() || '1',
      })
      .returning();

    // Recalcular subtotal del item
    await this.recalcularSubtotalItem(itemId);

    // Recalcular monto_total de la transacción
    await this.recalcularMontoTotal(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return extra;
  }

  async getExtras(transaccionId: number, itemId: number): Promise<any[]> {
    await this.findOne(transaccionId);

    const extras = await this.db
      .select({
        id: schema.detalle_item_extras.id,
        detalle_item_id: schema.detalle_item_extras.detalle_item_id,
        ingrediente_id: schema.detalle_item_extras.ingrediente_id,
        descripcion: schema.detalle_item_extras.descripcion,
        ingrediente_nombre: schema.ingredientes.nombre,
        precio: schema.detalle_item_extras.precio,
        cantidad: schema.detalle_item_extras.cantidad,
      })
      .from(schema.detalle_item_extras)
      .leftJoin(
        schema.ingredientes,
        eq(schema.detalle_item_extras.ingrediente_id, schema.ingredientes.id),
      )
      .where(
        and(
          eq(schema.detalle_item_extras.detalle_item_id, itemId),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );

    return extras.map((extra) => ({
      ...extra,
      nombre: extra.ingrediente_nombre || extra.descripcion,
    }));
  }

  async removeExtra(
    transaccionId: number,
    itemId: number,
    extraId: number,
  ): Promise<{ message: string }> {
    await this.findOne(transaccionId);

    const [extra] = await this.db
      .select()
      .from(schema.detalle_item_extras)
      .where(
        and(
          eq(schema.detalle_item_extras.id, extraId),
          eq(schema.detalle_item_extras.detalle_item_id, itemId),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );

    if (!extra) {
      throw new NotFoundException('Extra no encontrado');
    }

    await this.db
      .update(schema.detalle_item_extras)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.detalle_item_extras.id, extraId));

    // Recalcular subtotal del item
    await this.recalcularSubtotalItem(itemId);

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

    // Emitir evento de actualización a cocina
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }

    return { message: 'Extra eliminado correctamente' };
  }

  // ========== GESTIÓN DE PAGOS ==========

  async addPago(
    transaccionId: number,
    createPagoDto: CreatePagoDto,
    usuario_id: string,
  ): Promise<any> {
    const transaccion = await this.findOne(transaccionId);

    const monto_total = parseFloat(transaccion.monto_total);
    const monto_pagado = parseFloat(transaccion.monto_pagado);
    const monto_pendiente = monto_total - monto_pagado;

    if (monto_pendiente <= 0) {
      throw new BadRequestException(
        'La transacción ya está completamente pagada',
      );
    }

    if (createPagoDto.monto > monto_pendiente) {
      throw new BadRequestException(
        `El monto del pago (${createPagoDto.monto}) no puede ser mayor al monto pendiente (${monto_pendiente})`,
      );
    }

    // Validaciones específicas según método de pago
    if (createPagoDto.metodo_pago === 'efectivo') {
      if (!createPagoDto.monto_recibido) {
        throw new BadRequestException(
          'Para pagos en efectivo debe proporcionar monto_recibido',
        );
      }
      if (createPagoDto.monto_recibido < createPagoDto.monto) {
        throw new BadRequestException(
          'El monto recibido debe ser mayor o igual al monto del pago',
        );
      }
    }

    // Crear pago
    const [pago] = await this.db
      .insert(schema.pagos)
      .values({
        transaccion_id: transaccionId,
        metodo_pago: createPagoDto.metodo_pago,
        monto: createPagoDto.monto.toString(),
        monto_recibido: createPagoDto.monto_recibido?.toString() || null,
        referencia_qr: createPagoDto.referencia_qr || null,
        usuario_id,
      })
      .returning();

    // Actualizar monto_pagado en transacción
    const nuevo_monto_pagado = monto_pagado + createPagoDto.monto;
    await this.db
      .update(schema.transacciones)
      .set({
        monto_pagado: nuevo_monto_pagado.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));

    // Registrar pago en caja
    if (transaccion.caja_id) {
      await this.registrarPagoEnCaja(
        transaccion.caja_id,
        createPagoDto.metodo_pago,
        createPagoDto.monto,
      );
    }

    // Recalcular estado (puede cerrar si también la cocina está terminada)
    await this.recalcularEstado(transaccionId);

    // Calcular cambio para efectivo
    const cambio =
      createPagoDto.metodo_pago === 'efectivo' && createPagoDto.monto_recibido
        ? createPagoDto.monto_recibido - createPagoDto.monto
        : 0;

    return {
      ...pago,
      cambio: cambio.toFixed(2),
    };
  }

  async getPagos(transaccionId: number): Promise<Pago[]> {
    await this.findOne(transaccionId);

    return await this.db
      .select()
      .from(schema.pagos)
      .where(
        and(
          eq(schema.pagos.transaccion_id, transaccionId),
          isNull(schema.pagos.borrado_en),
        ),
      );
  }

  // ========== MÉTODOS INTERNOS ==========

  private async recalcularSubtotalItem(itemId: number): Promise<void> {
    // Obtener item
    const [item] = await this.db
      .select()
      .from(schema.detalle_items)
      .where(eq(schema.detalle_items.id, itemId));

    if (!item) return;

    // Calcular suma de extras
    const extras = await this.db
      .select()
      .from(schema.detalle_item_extras)
      .where(
        and(
          eq(schema.detalle_item_extras.detalle_item_id, itemId),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );

    const sumaExtras = extras.reduce((sum, extra) => {
      const precio = parseFloat(extra.precio ?? '0');
      const cantidad = parseFloat(extra.cantidad ?? '1');
      return sum + precio * cantidad;
    }, 0);

    // Calcular nuevo subtotal
    const subtotal_unitario = parseFloat(item.precio_unitario) + sumaExtras;
    const subtotal_total = subtotal_unitario * parseFloat(item.cantidad);

    // Actualizar item
    await this.db
      .update(schema.detalle_items)
      .set({
        subtotal: subtotal_total.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.detalle_items.id, itemId));
  }

  private async recalcularMontoTotal(transaccionId: number): Promise<void> {
    // Sumar todos los subtotales de items activos
    const items = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    const monto_total = items.reduce((sum, item) => {
      return sum + parseFloat(item.subtotal);
    }, 0);

    // Actualizar transacción
    await this.db
      .update(schema.transacciones)
      .set({
        monto_total: monto_total.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Recalcula y actualiza el estado de una transacción basándose en:
   * - estado_cocina: debe ser 'terminado'
   * - monto_pendiente: debe ser 0
   * Solo cierra si AMBAS condiciones se cumplen.
   */
  private async recalcularEstado(transaccionId: number): Promise<void> {
    const transaccion = await this.findOne(transaccionId);
    
    // Verificar si hay items de plato activos
    const items = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
          isNotNull(schema.detalle_items.plato_id),
        ),
      );

    // Si no hay platos, el estado_cocina ya no debería ser 'pendiente' si lo era
    if (items.length === 0 && transaccion.estado_cocina === 'pendiente') {
      await this.db
        .update(schema.transacciones)
        .set({ estado_cocina: null }) // O 'terminado', pero null indica sin pedidos
        .where(eq(schema.transacciones.id, transaccionId));
      transaccion.estado_cocina = null;
    }

    const monto_total = parseFloat(transaccion.monto_total);
    const monto_pagado = parseFloat(transaccion.monto_pagado);
    const monto_pendiente = monto_total - monto_pagado;

    const pagado_completo = monto_pendiente <= 0.01; // Tolerancia para decimales
    const cocina_terminada =
      transaccion.estado_cocina === 'terminado' ||
      transaccion.estado_cocina === 'anulado' ||
      transaccion.estado_cocina === null; // null = sin items de cocina

    let nuevoEstado: string;

    if (pagado_completo && cocina_terminada) {
      if (monto_total === 0) {
        nuevoEstado = 'pendiente'; // Es una orden vacía
      } else {
        nuevoEstado = 'cerrado';
        // Solo descontar stock cuando se cierra definitivamente
        if (transaccion.estado !== 'cerrado') {
          await this.descontarStock(transaccionId);
        }
      }
    } else if (monto_total > 0 || transaccion.estado_cocina === 'pendiente') {
      nuevoEstado = 'abierto';
    } else {
      nuevoEstado = 'pendiente';
    }

    // Solo actualizar si cambió el estado
    if (transaccion.estado !== nuevoEstado) {
      await this.db
        .update(schema.transacciones)
        .set({
          estado: nuevoEstado as any,
          actualizado_en: new Date(),
        })
        .where(eq(schema.transacciones.id, transaccionId));
    }
  }

  private async cerrarTransaccion(transaccionId: number): Promise<void> {
    // Ahora usa recalcularEstado que verifica ambas condiciones
    await this.recalcularEstado(transaccionId);
  }

  /**
   * Reabre una transacción cerrada para agregar más items.
   * Mantiene el monto_pagado para no cobrar lo ya pagado.
   * Solo se vuelve a cobrar el monto_pendiente nuevo.
   */
  async reabrirTransaccion(transaccionId: number): Promise<Transaccion> {
    const transaccion = await this.findOne(transaccionId);

    if (transaccion.estado !== 'cerrado') {
      throw new BadRequestException(
        'Solo se pueden reabrir transacciones cerradas',
      );
    }

    // Cambiar estado a abierto
    const [transaccionReabierta] = await this.db
      .update(schema.transacciones)
      .set({
        estado: 'abierto',
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId))
      .returning();

    return transaccionReabierta;
  }

  // ========== VISTA DE COCINA ==========

  async findPendientesCocina() {
    const transacciones = await this.db
      .select()
      .from(schema.transacciones)
      .where(
        and(
          eq(schema.transacciones.estado_cocina, 'pendiente'),
          isNull(schema.transacciones.borrado_en),
        ),
      )
      .orderBy(asc(schema.transacciones.fecha), asc(schema.transacciones.hora));

    if (transacciones.length === 0) return [];

    const transaccionIds = transacciones.map((t) => t.id);

    // Obtener todos los items para estas transacciones en una sola consulta
    const allItems = await this.db
      .select({
        id: schema.detalle_items.id,
        transaccion_id: schema.detalle_items.transaccion_id,
        producto_id: schema.detalle_items.producto_id,
        plato_id: schema.detalle_items.plato_id,
        producto_nombre: schema.productos.nombre,
        plato_nombre: schema.platos.nombre,
        cantidad: schema.detalle_items.cantidad,
        precio_unitario: schema.detalle_items.precio_unitario,
        subtotal: schema.detalle_items.subtotal,
        notas: schema.detalle_items.notas,
      })
      .from(schema.detalle_items)
      .leftJoin(
        schema.productos,
        eq(schema.detalle_items.producto_id, schema.productos.id),
      )
      .leftJoin(
        schema.platos,
        eq(schema.detalle_items.plato_id, schema.platos.id),
      )
      .where(
        and(
          inArray(schema.detalle_items.transaccion_id, transaccionIds),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    if (allItems.length === 0) {
      return transacciones.map((t) => ({
        ...t,
        monto_pendiente: (
          parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
        ).toFixed(2),
        items: [],
      }));
    }

    const itemIds = allItems.map((i) => i.id);

    // Obtener todos los extras para estos items en una sola consulta
    const allExtras = await this.db
      .select({
        id: schema.detalle_item_extras.id,
        detalle_item_id: schema.detalle_item_extras.detalle_item_id,
        ingrediente_id: schema.detalle_item_extras.ingrediente_id,
        descripcion: schema.detalle_item_extras.descripcion,
        ingrediente_nombre: schema.ingredientes.nombre,
        precio: schema.detalle_item_extras.precio,
        cantidad: schema.detalle_item_extras.cantidad,
      })
      .from(schema.detalle_item_extras)
      .leftJoin(
        schema.ingredientes,
        eq(schema.detalle_item_extras.ingrediente_id, schema.ingredientes.id),
      )
      .where(
        and(
          inArray(schema.detalle_item_extras.detalle_item_id, itemIds),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );

    // Agrupar en memoria para evitar el N+1
    const extrasByItemId = allExtras.reduce((acc, extra) => {
      if (!acc[extra.detalle_item_id]) acc[extra.detalle_item_id] = [];
      acc[extra.detalle_item_id].push({
        ...extra,
        nombre: extra.ingrediente_nombre || extra.descripcion,
      });
      return acc;
    }, {} as Record<number, any[]>);

    const itemsByTransaccionId = allItems.reduce((acc, item) => {
      if (!acc[item.transaccion_id]) acc[item.transaccion_id] = [];
      acc[item.transaccion_id].push({
        ...item,
        nombre: item.producto_nombre || item.plato_nombre,
        extras: extrasByItemId[item.id] || [],
      });
      return acc;
    }, {} as Record<number, any[]>);

    return transacciones.map((t) => ({
      ...t,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
      items: itemsByTransaccionId[t.id] || [],
    }));
  }

  async completarOrdenCocina(id: number) {
    try {
      await this.findOne(id); // Verificar existencia

      const result = await this.db
        .update(schema.transacciones)
        .set({
          estado_cocina: 'terminado',
          actualizado_en: new Date(),
        })
        .where(eq(schema.transacciones.id, id))
        .returning();

      // Recalcular estado (puede cerrar si también está pagado)
      await this.recalcularEstado(id);

      // Emitir evento de pedido completado
      try {
        this.cocinaGateway.emitPedidoCompletado(id);
        const pedidosPendientes = await this.findPendientesCocina();
        this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
      } catch (error) {
        console.error('Error al emitir actualización de cocina:', error);
      }

      return result;
    } catch (error) {
      console.error('Error en completarOrdenCocina:', error);
      throw new BadRequestException(
        'No se pudo completar la orden de cocina. Verifique que la columna estado_cocina exista en la base de datos.',
      );
    }
  }

  // ========== STOCK ==========

  private async descontarStock(transaccionId: number): Promise<void> {
    try {
      console.log(
        `[STOCK] Iniciando descuento para transacción ${transaccionId}`,
      );

      // Obtener todos los items de la transacción
      const items = await this.db
        .select()
        .from(schema.detalle_items)
        .where(
          and(
            eq(schema.detalle_items.transaccion_id, transaccionId),
            isNull(schema.detalle_items.borrado_en),
          ),
        );

      console.log(`[STOCK] Items encontrados: ${items.length}`);

      for (const item of items) {
        const cantidad = parseFloat(item.cantidad);
        console.log(
          `[STOCK] Procesando item ${item.id}: cantidad=${cantidad}, producto_id=${item.producto_id}, plato_id=${item.plato_id}`,
        );

        // Si es producto, descontar stock
        if (item.producto_id) {
          try {
            const [producto] = await this.db
              .select()
              .from(schema.productos)
              .where(eq(schema.productos.id, item.producto_id));

            if (producto) {
              const stock_anterior = producto.stock;
              const nuevo_stock = stock_anterior - Math.floor(cantidad);

              await this.db
                .update(schema.productos)
                .set({ stock: nuevo_stock })
                .where(eq(schema.productos.id, item.producto_id));

              console.log(
                `[STOCK] Producto ${item.producto_id}: ${stock_anterior} → ${nuevo_stock}`,
              );
            } else {
              console.warn(
                `[STOCK] Producto ${item.producto_id} no encontrado`,
              );
            }
          } catch (error) {
            console.error(
              `[STOCK] Error al descontar producto ${item.producto_id}:`,
              error,
            );
          }
        }

        // Si es plato, descontar ingredientes
        if (item.plato_id) {
          try {
            const ingredientes = await this.db
              .select()
              .from(schema.plato_ingredientes)
              .where(
                and(
                  eq(schema.plato_ingredientes.plato_id, item.plato_id),
                  isNull(schema.plato_ingredientes.borrado_en),
                ),
              );

            console.log(
              `[STOCK] Plato ${item.plato_id} tiene ${ingredientes.length} ingredientes`,
            );

            for (const pi of ingredientes) {
              try {
                const cantidadIngrediente = parseFloat(pi.cantidad.toString());
                const cantidad_descontar = cantidad * cantidadIngrediente;

                console.log(
                  `[STOCK] Descontando ingrediente ${pi.ingrediente_id}: ${cantidad_descontar} unidades`,
                );

                await this.db
                  .update(schema.ingredientes)
                  .set({
                    cantidad: sql`${schema.ingredientes.cantidad} - ${cantidad_descontar}`,
                  })
                  .where(eq(schema.ingredientes.id, pi.ingrediente_id));

                console.log(
                  `[STOCK] ✓ Ingrediente ${pi.ingrediente_id} descontado`,
                );
              } catch (error) {
                console.error(
                  `[STOCK] Error al descontar ingrediente ${pi.ingrediente_id}:`,
                  error,
                );
              }
            }
          } catch (error) {
            console.error(
              `[STOCK] Error al obtener ingredientes del plato ${item.plato_id}:`,
              error,
            );
          }
        }
      }

      // Descontar extras que tienen ingrediente_id
      console.log(`[STOCK] Procesando extras...`);

      for (const item of items) {
        try {
          const extras = await this.db
            .select()
            .from(schema.detalle_item_extras)
            .where(
              and(
                eq(schema.detalle_item_extras.detalle_item_id, item.id),
                isNull(schema.detalle_item_extras.borrado_en),
              ),
            );

          console.log(`[STOCK] Item ${item.id} tiene ${extras.length} extras`);

          for (const extra of extras) {
            if (extra.ingrediente_id) {
              try {
                const cantidad_extra = parseFloat(extra.cantidad ?? '1');

                console.log(
                  `[STOCK] Descontando extra ingrediente ${extra.ingrediente_id}: ${cantidad_extra} unidades`,
                );

                await this.db
                  .update(schema.ingredientes)
                  .set({
                    cantidad: sql`${schema.ingredientes.cantidad} - ${cantidad_extra}`,
                  })
                  .where(eq(schema.ingredientes.id, extra.ingrediente_id));

                console.log(
                  `[STOCK] ✓ Extra ingrediente ${extra.ingrediente_id} descontado`,
                );
              } catch (error) {
                console.error(
                  `[STOCK] Error al descontar extra ingrediente ${extra.ingrediente_id}:`,
                  error,
                );
              }
            } else {
              console.log(
                `[STOCK] Extra ${extra.id} no tiene ingrediente_id (es descripción libre)`,
              );
            }
          }
        } catch (error) {
          console.error(
            `[STOCK] Error al procesar extras del item ${item.id}:`,
            error,
          );
        }
      }

      console.log(
        `[STOCK] ✓ Descuento completado para transacción ${transaccionId}`,
      );
    } catch (error) {
      console.error(
        `[STOCK] ERROR CRÍTICO en descontarStock para transacción ${transaccionId}:`,
        error,
      );
      // No lanzar error para no bloquear el cierre de la transacción
      // pero loggear para debugging
    }
  }

  // ========== INTEGRACIÓN CON CAJA ==========

  /**
   * Registrar pago en la caja automáticamente
   */
  private async registrarPagoEnCaja(
    cajaId: number,
    metodoPago: 'efectivo' | 'qr',
    monto: number,
  ): Promise<void> {
    const [caja] = await this.db
      .select()
      .from(schema.caja_turno)
      .where(eq(schema.caja_turno.id, cajaId));

    if (!caja) return;

    const ventasEfectivo = parseFloat(caja.ventas_efectivo || '0');
    const ventasQr = parseFloat(caja.ventas_qr || '0');

    if (metodoPago === 'efectivo') {
      await this.db
        .update(schema.caja_turno)
        .set({
          ventas_efectivo: (ventasEfectivo + monto).toFixed(2),
        })
        .where(eq(schema.caja_turno.id, cajaId));
    } else if (metodoPago === 'qr') {
      await this.db
        .update(schema.caja_turno)
        .set({
          ventas_qr: (ventasQr + monto).toFixed(2),
        })
        .where(eq(schema.caja_turno.id, cajaId));
    }
  }

  /**
   * Obtener transacciones de una caja específica
   */
  async findByCaja(cajaId: number): Promise<any[]> {
    const transacciones = await this.db
      .select()
      .from(schema.transacciones)
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
        ),
      )
      .orderBy(desc(schema.transacciones.hora));

    return transacciones.map((t: any) => ({
      ...t,
      hora: t.hora ? t.hora.toISOString() : null,
      creado_en: t.creado_en ? t.creado_en.toISOString() : null,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
    }));
  }

  /**
   * 📊 Obtener resumen de items vendidos por caja
   * Agrupa por producto/plato y suma cantidades y subtotales
   */
  async getResumenItemsPorCaja(cajaId: number) {
    // Obtener todos los items de transacciones de esta caja
    const items = await this.db
      .select({
        producto_id: schema.detalle_items.producto_id,
        plato_id: schema.detalle_items.plato_id,
        producto_nombre: schema.productos.nombre,
        plato_nombre: schema.platos.nombre,
        cantidad: schema.detalle_items.cantidad,
        subtotal: schema.detalle_items.subtotal,
      })
      .from(schema.detalle_items)
      .innerJoin(
        schema.transacciones,
        eq(schema.detalle_items.transaccion_id, schema.transacciones.id),
      )
      .leftJoin(
        schema.productos,
        eq(schema.detalle_items.producto_id, schema.productos.id),
      )
      .leftJoin(
        schema.platos,
        eq(schema.detalle_items.plato_id, schema.platos.id),
      )
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
          isNull(schema.detalle_items.borrado_en),
          // Opcional: solo transacciones pagadas/cerradas?
          // Por ahora incluimos todas las registradas en la caja
        ),
      );

    // Agrupar y sumar
    const agrupado = new Map<
      string,
      {
        nombre: string;
        cantidad: number;
        total: number;
        tipo: 'producto' | 'plato';
      }
    >();

    for (const item of items) {
      const isProducto = !!item.producto_id;
      const idStr = isProducto ? `p-${item.producto_id}` : `d-${item.plato_id}`;
      const nombre = isProducto
        ? item.producto_nombre || 'Producto desconocido'
        : item.plato_nombre || 'Plato desconocido';

      const cantidad = parseFloat(item.cantidad);
      const subtotal = parseFloat(item.subtotal);

      const actual = agrupado.get(idStr);
      if (actual) {
        actual.cantidad += cantidad;
        actual.total += subtotal;
      } else {
        agrupado.set(idStr, {
          nombre,
          cantidad,
          total: subtotal,
          tipo: isProducto ? 'producto' : 'plato',
        });
      }
    }

    return Array.from(agrupado.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * 🗑️ Obtener items eliminados de transacciones asociadas a una caja
   */
  async findDeletedItemsByCaja(cajaId: number) {
    const items = await this.db
      .select({
        id: schema.detalle_items.id,
        transaccion_id: schema.detalle_items.transaccion_id,
        transaccion_nro: schema.transacciones.nro_reg,
        producto_nombre: schema.productos.nombre,
        plato_nombre: schema.platos.nombre,
        cantidad: schema.detalle_items.cantidad,
        precio_unitario: schema.detalle_items.precio_unitario,
        subtotal: schema.detalle_items.subtotal,
        borrado_en: schema.detalle_items.borrado_en,
      })
      .from(schema.detalle_items)
      .innerJoin(
        schema.transacciones,
        eq(schema.detalle_items.transaccion_id, schema.transacciones.id),
      )
      .leftJoin(
        schema.productos,
        eq(schema.detalle_items.producto_id, schema.productos.id),
      )
      .leftJoin(
        schema.platos,
        eq(schema.detalle_items.plato_id, schema.platos.id),
      )
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNotNull(schema.detalle_items.borrado_en),
        ),
      );

    return items.map((item) => ({
      ...item,
      borrado_en: item.borrado_en ? item.borrado_en.toISOString() : null,
    }));
  }

  /**
   * 📋 Obtener ventas detalladas con información de usuario y pagos
   */
  async findDetailedVentasByCaja(cajaId: number) {
    const ventas = await this.db
      .select({
        id: schema.transacciones.id,
        nro_reg: schema.transacciones.nro_reg,
        fecha: schema.transacciones.fecha,
        hora: schema.transacciones.hora,
        monto_total: schema.transacciones.monto_total,
        monto_pagado: schema.transacciones.monto_pagado,
        mesa: schema.transacciones.mesa,
        cliente: schema.transacciones.cliente,
        estado: schema.transacciones.estado,
        borrado_en: schema.transacciones.borrado_en,
        usuario_nombre: schema.usuarios.nombre,
      })
      .from(schema.transacciones)
      .leftJoin(schema.usuarios, eq(schema.transacciones.usuario_id, schema.usuarios.id))
      .where(
        eq(schema.transacciones.caja_id, cajaId),
      );

    // Complementar con pagos para cada venta
    const result = await Promise.all(
      ventas.map(async (v: any) => {
        const pagosVenta = await this.db
          .select()
          .from(schema.pagos)
          .where(eq(schema.pagos.transaccion_id, v.id));
        
        return {
          ...v,
          hora: v.hora ? v.hora.toISOString() : null,
          fecha: v.fecha ? v.fecha.toString() : null,
          pagos: pagosVenta.map((p: any) => ({
            ...p,
            creado_en: p.creado_en ? p.creado_en.toISOString() : null
          })),
        };
      })
    );

    return result;
  }
}

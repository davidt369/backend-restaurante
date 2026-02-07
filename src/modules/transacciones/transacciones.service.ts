import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { eq, isNull, and, sql, desc } from 'drizzle-orm';
import { CreateTransaccionDto } from './dto/create-transaccion.dto';
import { UpdateTransaccionDto } from './dto/update-transaccion.dto';
import { AddItemDto } from './dto/add-item.dto';
import { AddExtraDto } from './dto/add-extra.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import type { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

type Transaccion = InferSelectModel<typeof schema.transacciones>;
type DetalleItem = InferSelectModel<typeof schema.detalle_items>;
type DetalleItemExtra = InferSelectModel<typeof schema.detalle_item_extras>;
type Pago = InferSelectModel<typeof schema.pagos>;

@Injectable()
export class TransaccionesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(
    createTransaccionDto: CreateTransaccionDto,
    usuario_id: string,
  ): Promise<Transaccion> {
    const [transaccion] = await this.db
      .insert(schema.transacciones)
      .values({
        ...createTransaccionDto,
        usuario_id,
        monto_total: '0',
        monto_pagado: '0',
      })
      .returning();

    return transaccion;
  }

  async findAll(): Promise<any[]> {
    const transacciones = await this.db
      .select()
      .from(schema.transacciones)
      .where(isNull(schema.transacciones.borrado_en))
      .orderBy(desc(schema.transacciones.hora));

    // Add calculated monto_pendiente field
    return transacciones.map((t) => ({
      ...t,
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

    return transaccionActualizada;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.db
      .update(schema.transacciones)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, id));

    return {
      message: `Transacción con ID ${id} eliminada exitosamente (soft delete)`,
    };
  }

  // ========== GESTIÓN DE ITEMS ==========

  async addItem(
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
            eq(schema.platos.id, addItemDto.plato_id!),
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

    // Recalcular monto_total
    await this.recalcularMontoTotal(transaccionId);

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

    // Si está completamente pagado, cerrar transacción y descontar stock
    if (nuevo_monto_pagado >= monto_total) {
      await this.cerrarTransaccion(transaccionId);
    }

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
    const subtotal_base =
      parseFloat(item.precio_unitario) * parseFloat(item.cantidad);
    const subtotal_total = subtotal_base + sumaExtras;

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

  private async cerrarTransaccion(transaccionId: number): Promise<void> {
    // Cambiar estado a cerrado
    await this.db
      .update(schema.transacciones)
      .set({
        estado: 'cerrado',
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));

    // Descontar stock de productos e ingredientes
    await this.descontarStock(transaccionId);
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

  private async descontarStock(transaccionId: number): Promise<void> {
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

    for (const item of items) {
      const cantidad = parseFloat(item.cantidad);

      // Si es producto, descontar stock
      if (item.producto_id) {
        const [producto] = await this.db
          .select()
          .from(schema.productos)
          .where(eq(schema.productos.id, item.producto_id));

        if (producto) {
          const nuevo_stock = producto.stock - Math.floor(cantidad);
          await this.db
            .update(schema.productos)
            .set({ stock: nuevo_stock })
            .where(eq(schema.productos.id, item.producto_id));
        }
      }

      // Si es plato, descontar ingredientes
      if (item.plato_id) {
        const ingredientes = await this.db
          .select()
          .from(schema.plato_ingredientes)
          .where(
            and(
              eq(schema.plato_ingredientes.plato_id, item.plato_id),
              isNull(schema.plato_ingredientes.borrado_en),
            ),
          );

        for (const pi of ingredientes) {
          const cantidadIngrediente = parseFloat(pi.cantidad.toString());
          const cantidad_descontar = cantidad * cantidadIngrediente;

          await this.db
            .update(schema.ingredientes)
            .set({
              cantidad: sql`${schema.ingredientes.cantidad} - ${cantidad_descontar}`,
            })
            .where(eq(schema.ingredientes.id, pi.ingrediente_id));
        }
      }
    }

    // Descontar extras que tienen ingrediente_id
    const todosLosItems = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    for (const item of todosLosItems) {
      const extras = await this.db
        .select()
        .from(schema.detalle_item_extras)
        .where(
          and(
            eq(schema.detalle_item_extras.detalle_item_id, item.id),
            isNull(schema.detalle_item_extras.borrado_en),
          ),
        );

      for (const extra of extras) {
        if (extra.ingrediente_id) {
          const cantidad_extra = parseFloat(extra.cantidad ?? '1');

          await this.db
            .update(schema.ingredientes)
            .set({
              cantidad: sql`${schema.ingredientes.cantidad} - ${cantidad_extra}`,
            })
            .where(eq(schema.ingredientes.id, extra.ingrediente_id));
        }
      }
    }
  }
}

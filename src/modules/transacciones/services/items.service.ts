import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { AddItemDto } from '../dto/add-item.dto';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import type { InferSelectModel } from 'drizzle-orm';

type DetalleItem = InferSelectModel<typeof schema.detalle_items>;

/**
 * ItemsService
 * Responsabilidad: Se encarga de lo que el cliente consume
 * 
 * Maneja la lógica de los artículos dentro de un pedido. Si quieres añadir
 * una hamburguesa, este servicio valida si el producto existe y calcula
 * cuánto cuesta ese ítem individualmente antes de sumarlo al total.
 */
@Injectable()
export class ItemsService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Agregar un item a una transacción
   */
  async addItem(
    transaccionId: number,
    addItemDto: AddItemDto,
  ): Promise<DetalleItem> {
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

    return item;
  }

  /**
   * Obtener todos los items de una transacción
   */
  async getItems(transaccionId: number): Promise<any[]> {
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

  /**
   * Obtener un item específico
   */
  async getItem(itemId: number): Promise<DetalleItem> {
    const [item] = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.id, itemId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    return item;
  }

  /**
   * Eliminar un item
   */
  async removeItem(itemId: number): Promise<{ message: string }> {
    const item = await this.getItem(itemId);

    await this.db
      .update(schema.detalle_items)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.detalle_items.id, itemId));

    return { message: 'Item eliminado correctamente' };
  }

  /**
   * Actualizar subtotal de un item
   */
  async updateSubtotal(itemId: number, subtotal: number): Promise<void> {
    await this.db
      .update(schema.detalle_items)
      .set({
        subtotal: subtotal.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.detalle_items.id, itemId));
  }

  /**
   * Obtener todos los items activos de una transacción para cálculos
   */
  async getItemsActivos(transaccionId: number): Promise<DetalleItem[]> {
    return await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );
  }
}

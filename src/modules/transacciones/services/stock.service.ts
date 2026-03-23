import {
  Injectable,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import { ItemsService } from './items.service';
import { ExtrasService } from './extras.service';

/**
 * StockService
 * Responsabilidad: Controla las existencias físicas
 * 
 * Cada vez que se confirma una venta, este servicio "mira" en el almacén y
 * resta los ingredientes. Separarlo permite que, si en el futuro quieres
 * integrar un software externo de almacén, solo tengas que modificar este servicio.
 */
@Injectable()
export class StockService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly itemsService: ItemsService,
    private readonly extrasService: ExtrasService,
  ) {}

  /**
   * Descontar stock cuando se cierra una transacción
   */
  async descontarStock(transaccionId: number): Promise<void> {
    try {
      console.log(
        `[STOCK] Iniciando descuento para transacción ${transaccionId}`,
      );

      // Obtener todos los items de la transacción
      const items = await this.itemsService.getItemsActivos(transaccionId);

      console.log(`[STOCK] Items encontrados: ${items.length}`);

      for (const item of items) {
        const cantidad = parseFloat(item.cantidad);
        console.log(
          `[STOCK] Procesando item ${item.id}: cantidad=${cantidad}, producto_id=${item.producto_id}, plato_id=${item.plato_id}`,
        );

        // Si es producto, descontar stock
        if (item.producto_id) {
          await this.descontarProducto(item.producto_id, cantidad);
        }

        // Si es plato, descontar ingredientes
        if (item.plato_id) {
          await this.descontarIngredientesPlato(item.plato_id, cantidad);
        }

        // Descontar extras
        await this.descontarExtrasItem(item.id, cantidad);
      }

      console.log(
        `[STOCK] ✓ Descuento completado para transacción ${transaccionId}`,
      );
    } catch (error) {
      console.error(
        `[STOCK] ERROR CRÍTICO en descontarStock para transacción ${transaccionId}:`,
        error,
      );
    }
  }

  /**
   * Descontar stock de un producto
   */
  private async descontarProducto(productoId: string | number, cantidad: number): Promise<void> {
    try {
      const [producto] = await this.db
        .select()
        .from(schema.productos)
        .where(eq(schema.productos.id, String(productoId)));

      if (producto) {
        const stock_anterior = producto.stock;
        const nuevo_stock = stock_anterior - Math.floor(cantidad);

        await this.db
          .update(schema.productos)
          .set({ stock: nuevo_stock })
          .where(eq(schema.productos.id, String(productoId)));

        console.log(
          `[STOCK] Producto ${productoId}: ${stock_anterior} → ${nuevo_stock}`,
        );
      } else {
        console.warn(`[STOCK] Producto ${productoId} no encontrado`);
      }
    } catch (error) {
      console.error(
        `[STOCK] Error al descontar producto ${productoId}:`,
        error,
      );
    }
  }

  /**
   * Descontar ingredientes de un plato
   */
  private async descontarIngredientesPlato(
    platoId: string | number,
    cantidad: number,
  ): Promise<void> {
    try {
      const ingredientes = await this.db
        .select()
        .from(schema.plato_ingredientes)
        .where(
          and(
            eq(schema.plato_ingredientes.plato_id, String(platoId)),
            isNull(schema.plato_ingredientes.borrado_en),
          ),
        );

      console.log(
        `[STOCK] Plato ${platoId} tiene ${ingredientes.length} ingredientes`,
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
            .where(eq(schema.ingredientes.id, String(pi.ingrediente_id)));

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
        `[STOCK] Error al obtener ingredientes del plato ${platoId}:`,
        error,
      );
    }
  }

  /**
   * Descontar extras de un item
   */
  private async descontarExtrasItem(
    itemId: number,
    cantidadItem: number,
  ): Promise<void> {
    try {
      const extras = await this.extrasService.getExtrasActivos(itemId);

      console.log(`[STOCK] Item ${itemId} tiene ${extras.length} extras`);

      for (const extra of extras) {
        if (extra.ingrediente_id) {
          try {
            const cantidad_extra = parseFloat(extra.cantidad ?? '1');
            const cantidad_descontar = cantidad_extra * cantidadItem;

            console.log(
              `[STOCK] Descontando extra ingrediente ${extra.ingrediente_id}: ${cantidad_descontar} unidades`,
            );

            await this.db
              .update(schema.ingredientes)
              .set({
                cantidad: sql`${schema.ingredientes.cantidad} - ${cantidad_descontar}`,
              })
              .where(eq(schema.ingredientes.id, String(extra.ingrediente_id)));

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
      console.error(`[STOCK] Error al procesar extras del item ${itemId}:`, error);
    }
  }

  /**
   * Obtener stock de un producto
   */
  async getStockProducto(productoId: string | number): Promise<number> {
    const [producto] = await this.db
      .select({ stock: schema.productos.stock })
      .from(schema.productos)
      .where(eq(schema.productos.id, String(productoId)));

    return producto?.stock ?? 0;
  }

  /**
   * Obtener cantidad de un ingrediente
   */
  async getCantidadIngrediente(ingredienteId: string | number): Promise<number> {
    const [ingrediente] = await this.db
      .select({ cantidad: schema.ingredientes.cantidad })
      .from(schema.ingredientes)
      .where(eq(schema.ingredientes.id, String(ingredienteId)));

    return ingrediente?.cantidad ?? 0;
  }

  /**
   * Validar si hay suficiente stock para un producto
   */
  async haySufficientStock(
    productoId: string | number,
    cantidadRequerida: number,
  ): Promise<boolean> {
    const stock = await this.getStockProducto(productoId);
    return stock >= cantidadRequerida;
  }

  /**
   * Validar si hay suficiente cantidad de ingrediente
   */
  async haySufficientIngrediente(
    ingredienteId: string | number,
    cantidadRequerida: number,
  ): Promise<boolean> {
    const cantidad = await this.getCantidadIngrediente(ingredienteId);
    return cantidad >= cantidadRequerida;
  }
}

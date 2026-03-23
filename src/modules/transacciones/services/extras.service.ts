import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { AddExtraDto } from '../dto/add-extra.dto';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import type { InferSelectModel } from 'drizzle-orm';

type DetalleItemExtra = InferSelectModel<typeof schema.detalle_item_extras>;

/**
 * ExtrasService
 * Responsabilidad: Maneja las modificaciones de los productos
 * 
 * Si la hamburguesa lleva "extra de queso", este servicio gestiona ese
 * añadido. Separa esta lógica para no ensuciar el ItemsService,
 * permitiendo reglas complejas como "un extra solo puede ir en ciertos platos".
 */
@Injectable()
export class ExtrasService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Agregar un extra a un item
   */
  async addExtra(
    itemId: number,
    addExtraDto: AddExtraDto,
  ): Promise<DetalleItemExtra> {
    // Verificar que el item exista
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

    return extra;
  }

  /**
   * Obtener todos los extras de un item
   */
  async getExtras(itemId: number): Promise<any[]> {
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

  /**
   * Obtener extras activos de un item para cálculos
   */
  async getExtrasActivos(itemId: number): Promise<DetalleItemExtra[]> {
    return await this.db
      .select()
      .from(schema.detalle_item_extras)
      .where(
        and(
          eq(schema.detalle_item_extras.detalle_item_id, itemId),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );
  }

  /**
   * Eliminar un extra
   */
  async removeExtra(extraId: number): Promise<{ message: string }> {
    const [extra] = await this.db
      .select()
      .from(schema.detalle_item_extras)
      .where(
        and(
          eq(schema.detalle_item_extras.id, extraId),
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

    return { message: 'Extra eliminado correctamente' };
  }

  /**
   * Cargar extras al crear un item
   */
  async createExtrasFromDto(
    itemId: number,
    extras: Array<{
      ingrediente_id?: string | number;
      descripcion?: string;
      precio: number;
      cantidad?: number;
    }>,
  ): Promise<void> {
    for (const extraDto of extras) {
      if (
        !extraDto.ingrediente_id &&
        !extraDto.descripcion &&
        !extraDto.precio
      ) {
        continue;
      }

      await this.db.insert(schema.detalle_item_extras).values({
        detalle_item_id: itemId,
        ingrediente_id: extraDto.ingrediente_id ? String(extraDto.ingrediente_id) : null,
        descripcion: extraDto.descripcion || null,
        precio: extraDto.precio.toString(),
        cantidad: extraDto.cantidad?.toString() || '1',
      });
    }
  }
}

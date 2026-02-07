import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { nanoid } from 'nanoid';
import type { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

type Producto = InferSelectModel<typeof schema.productos>;

@Injectable()
export class ProductosService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    const id = nanoid(10);

    const [producto] = await this.db
      .insert(schema.productos)
      .values({
        id,
        nombre: createProductoDto.nombre,
        precio: String(createProductoDto.precio),
        stock: createProductoDto.stock,
        unidad: createProductoDto.unidad,
      })
      .returning();

    return producto;
  }

  async findAll(): Promise<Producto[]> {
    return await this.db
      .select()
      .from(schema.productos)
      .where(isNull(schema.productos.borrado_en));
  }

  async findOne(id: string): Promise<Producto> {
    const [producto] = await this.db
      .select()
      .from(schema.productos)
      .where(
        and(eq(schema.productos.id, id), isNull(schema.productos.borrado_en)),
      );

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return producto;
  }

  async update(
    id: string,
    updateProductoDto: UpdateProductoDto,
  ): Promise<Producto> {
    await this.findOne(id);

    const updateData: Record<string, any> = {
      actualizado_en: new Date(),
    };

    if (updateProductoDto.nombre !== undefined) {
      updateData.nombre = updateProductoDto.nombre;
    }
    if (updateProductoDto.precio !== undefined) {
      updateData.precio = String(updateProductoDto.precio);
    }
    if (updateProductoDto.stock !== undefined) {
      updateData.stock = updateProductoDto.stock;
    }
    if (updateProductoDto.unidad !== undefined) {
      updateData.unidad = updateProductoDto.unidad;
    }

    const [productoActualizado] = await this.db
      .update(schema.productos)
      .set(updateData)
      .where(eq(schema.productos.id, id))
      .returning();

    return productoActualizado;
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);

    await this.db
      .update(schema.productos)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.productos.id, id));

    return {
      message: `Producto con ID ${id} eliminado exitosamente (soft delete)`,
    };
  }
}

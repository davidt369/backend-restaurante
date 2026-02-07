import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateIngredienteDto } from './dto/create-ingrediente.dto';
import { UpdateIngredienteDto } from './dto/update-ingrediente.dto';
import { nanoid } from 'nanoid';
import type { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

type Ingrediente = InferSelectModel<typeof schema.ingredientes>;

@Injectable()
export class IngredientesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(
    createIngredienteDto: CreateIngredienteDto,
  ): Promise<Ingrediente> {
    const id = nanoid(10);

    const [ingrediente] = await this.db
      .insert(schema.ingredientes)
      .values({
        id,
        ...createIngredienteDto,
      })
      .returning();

    return ingrediente;
  }

  async findAll(): Promise<Ingrediente[]> {
    return await this.db
      .select()
      .from(schema.ingredientes)
      .where(isNull(schema.ingredientes.borrado_en));
  }

  async findOne(id: string): Promise<Ingrediente> {
    const [ingrediente] = await this.db
      .select()
      .from(schema.ingredientes)
      .where(
        and(
          eq(schema.ingredientes.id, id),
          isNull(schema.ingredientes.borrado_en),
        ),
      );

    if (!ingrediente) {
      throw new NotFoundException(`Ingrediente con ID ${id} no encontrado`);
    }

    return ingrediente;
  }

  async update(
    id: string,
    updateIngredienteDto: UpdateIngredienteDto,
  ): Promise<Ingrediente> {
    await this.findOne(id);

    const [ingredienteActualizado] = await this.db
      .update(schema.ingredientes)
      .set({
        ...updateIngredienteDto,
        actualizado_en: new Date(),
      })
      .where(eq(schema.ingredientes.id, id))
      .returning();

    return ingredienteActualizado;
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);

    await this.db
      .update(schema.ingredientes)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.ingredientes.id, id));

    return {
      message: `Ingrediente con ID ${id} eliminado exitosamente (soft delete)`,
    };
  }
}

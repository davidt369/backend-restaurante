import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { CreatePlatoDto } from './dto/create-plato.dto';
import { UpdatePlatoDto } from './dto/update-plato.dto';
import { AddIngredienteDto } from './dto/add-ingrediente.dto';
import { UpdatePlatoIngredienteDto } from './dto/update-ingrediente.dto';
import { nanoid } from 'nanoid';
import type { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

type Plato = InferSelectModel<typeof schema.platos>;
type PlatoIngrediente = InferSelectModel<typeof schema.plato_ingredientes>;

@Injectable()
export class PlatosService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  async create(createPlatoDto: CreatePlatoDto): Promise<Plato> {
    const id = nanoid(10);

    const [plato] = await this.db
      .insert(schema.platos)
      .values({
        id,
        nombre: createPlatoDto.nombre,
        precio: createPlatoDto.precio.toString(),
      })
      .returning();

    return plato;
  }

  async findAll(): Promise<Plato[]> {
    return await this.db
      .select()
      .from(schema.platos)
      .where(isNull(schema.platos.borrado_en));
  }

  async findOne(id: string): Promise<Plato> {
    const [plato] = await this.db
      .select()
      .from(schema.platos)
      .where(and(eq(schema.platos.id, id), isNull(schema.platos.borrado_en)));

    if (!plato) {
      throw new NotFoundException(`Plato con ID ${id} no encontrado`);
    }

    return plato;
  }

  async update(id: string, updatePlatoDto: UpdatePlatoDto): Promise<Plato> {
    await this.findOne(id);

    const updateData: Partial<Omit<Plato, 'id' | 'creado_en'>> = {
      actualizado_en: new Date(),
    };

    if (updatePlatoDto.nombre !== undefined) {
      updateData.nombre = updatePlatoDto.nombre;
    }

    if (updatePlatoDto.precio !== undefined) {
      updateData.precio = updatePlatoDto.precio.toString();
    }

    const [platoActualizado] = await this.db
      .update(schema.platos)
      .set(updateData)
      .where(eq(schema.platos.id, id))
      .returning();

    return platoActualizado;
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);

    await this.db
      .update(schema.platos)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(eq(schema.platos.id, id));

    return {
      message: `Plato con ID ${id} eliminado exitosamente (soft delete)`,
    };
  }

  // Gestión de ingredientes
  async addIngrediente(
    platoId: string,
    addIngredienteDto: AddIngredienteDto,
  ): Promise<PlatoIngrediente> {
    // Verificar que el plato existe
    await this.findOne(platoId);

    // Verificar que el ingrediente existe
    const [ingrediente] = await this.db
      .select()
      .from(schema.ingredientes)
      .where(
        and(
          eq(schema.ingredientes.id, addIngredienteDto.ingrediente_id),
          isNull(schema.ingredientes.borrado_en),
        ),
      );

    if (!ingrediente) {
      throw new NotFoundException(
        `Ingrediente con ID ${addIngredienteDto.ingrediente_id} no encontrado`,
      );
    }

    // Verificar si ya existe la relación (incluyendo borrados)
    const [existente] = await this.db
      .select()
      .from(schema.plato_ingredientes)
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          eq(
            schema.plato_ingredientes.ingrediente_id,
            addIngredienteDto.ingrediente_id,
          ),
        ),
      );

    // Si existe y NO está borrado, lanzar error
    if (existente && !existente.borrado_en) {
      throw new BadRequestException(
        'Este ingrediente ya está agregado al plato',
      );
    }

    // Si existe pero está borrado, restaurarlo
    if (existente && existente.borrado_en) {
      const [platoIngrediente] = await this.db
        .update(schema.plato_ingredientes)
        .set({
          cantidad: addIngredienteDto.cantidad,
          borrado_en: null,
          actualizado_en: new Date(),
        })
        .where(
          and(
            eq(schema.plato_ingredientes.plato_id, platoId),
            eq(
              schema.plato_ingredientes.ingrediente_id,
              addIngredienteDto.ingrediente_id,
            ),
          ),
        )
        .returning();

      return platoIngrediente;
    }

    // Si no existe, crear nuevo registro
    const [platoIngrediente] = await this.db
      .insert(schema.plato_ingredientes)
      .values({
        plato_id: platoId,
        ingrediente_id: addIngredienteDto.ingrediente_id,
        cantidad: addIngredienteDto.cantidad,
      })
      .returning();

    return platoIngrediente;
  }

  async getIngredientes(platoId: string): Promise<any[]> {
    await this.findOne(platoId);

    const result = await this.db
      .select({
        ingrediente_id: schema.plato_ingredientes.ingrediente_id,
        cantidad: schema.plato_ingredientes.cantidad,
        nombre: schema.ingredientes.nombre,
        unidad: schema.ingredientes.unidad,
      })
      .from(schema.plato_ingredientes)
      .leftJoin(
        schema.ingredientes,
        eq(schema.plato_ingredientes.ingrediente_id, schema.ingredientes.id),
      )
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          isNull(schema.plato_ingredientes.borrado_en),
        ),
      );

    return result;
  }

  async removeIngrediente(
    platoId: string,
    ingredienteId: string,
  ): Promise<{ message: string }> {
    await this.findOne(platoId);

    const [relacion] = await this.db
      .select()
      .from(schema.plato_ingredientes)
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          eq(schema.plato_ingredientes.ingrediente_id, ingredienteId),
          isNull(schema.plato_ingredientes.borrado_en),
        ),
      );

    if (!relacion) {
      throw new NotFoundException('La relación plato-ingrediente no existe');
    }

    await this.db
      .update(schema.plato_ingredientes)
      .set({
        borrado_en: new Date(),
        actualizado_en: new Date(),
      })
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          eq(schema.plato_ingredientes.ingrediente_id, ingredienteId),
        ),
      );

    return {
      message: 'Ingrediente removido del plato exitosamente',
    };
  }

  async updateIngrediente(
    platoId: string,
    ingredienteId: string,
    updatePlatoIngredienteDto: UpdatePlatoIngredienteDto,
  ): Promise<{ message: string }> {
    await this.findOne(platoId);

    const [relacion] = await this.db
      .select()
      .from(schema.plato_ingredientes)
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          eq(schema.plato_ingredientes.ingrediente_id, ingredienteId),
          isNull(schema.plato_ingredientes.borrado_en),
        ),
      );

    if (!relacion) {
      throw new NotFoundException('La relación plato-ingrediente no existe');
    }

    await this.db
      .update(schema.plato_ingredientes)
      .set({
        cantidad: updatePlatoIngredienteDto.cantidad,
        actualizado_en: new Date(),
      })
      .where(
        and(
          eq(schema.plato_ingredientes.plato_id, platoId),
          eq(schema.plato_ingredientes.ingrediente_id, ingredienteId),
        ),
      );

    return {
      message: 'Cantidad de ingrediente actualizada correctamente',
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and, desc } from 'drizzle-orm';
import { CreateTransaccionDto } from '../dto/create-transaccion.dto';
import { UpdateTransaccionDto } from '../dto/update-transaccion.dto';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import { CajaService } from '../../caja/caja.service';
import type { InferSelectModel } from 'drizzle-orm';

type Transaccion = InferSelectModel<typeof schema.transacciones>;

/**
 * TransaccionesCoreService
 * Responsabilidad: Gestión básica de transacciones (CRUD)
 * 
 * Solo se encarga del CRUD (Crear, Leer, Actualizar, Borrar).
 * No decide si un pago es válido o si hay stock; simplemente
 * guarda o recupera la cabecera de la transacción de la base de datos.
 */
@Injectable()
export class TransaccionesCoreService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly cajaService: CajaService,
  ) {}

  /**
   * Crear una nueva transacción
   */
  async create(
    createTransaccionDto: CreateTransaccionDto,
    usuario_id: string,
  ): Promise<any> {
    // Intentar obtener caja abierta (opcional)
    let caja_id = createTransaccionDto.caja_id;

    try {
      const cajaAbierta = await this.cajaService.obtenerCajaAbierta();
      if (cajaAbierta) {
        if (!caja_id) {
          caja_id = cajaAbierta.id;
        } else if (caja_id !== cajaAbierta.id) {
          throw new BadRequestException(
            'El ID de caja no coincide con la caja actualmente abierta.',
          );
        }
      }
    } catch {
      console.warn(
        'No se pudo obtener caja abierta, creando transacción sin caja',
      );
    }

    const [transaccion] = await this.db
      .insert(schema.transacciones)
      .values({
        ...createTransaccionDto,
        caja_id,
        usuario_id,
        monto_total: '0',
        monto_pagado: '0',
      })
      .returning();

    return {
      ...transaccion,
      monto_pendiente: '0.00',
    };
  }

  /**
   * Obtener todas las transacciones no eliminadas
   */
  async findAll(): Promise<any[]> {
    const transacciones = await this.db
      .select()
      .from(schema.transacciones)
      .where(isNull(schema.transacciones.borrado_en))
      .orderBy(desc(schema.transacciones.hora));

    return transacciones.map((t) => ({
      ...t,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
    }));
  }

  /**
   * Obtener una transacción por ID
   */
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

    return {
      ...transaccion,
      monto_pendiente: (
        parseFloat(transaccion.monto_total) -
        parseFloat(transaccion.monto_pagado)
      ).toFixed(2),
    };
  }

  /**
   * Actualizar una transacción
   */
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

  /**
   * Eliminar (soft delete) una transacción
   */
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

  /**
   * Actualizar monto_total de una transacción
   */
  async updateMontoTotal(transaccionId: number, monto: number): Promise<void> {
    await this.db
      .update(schema.transacciones)
      .set({
        monto_total: monto.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Actualizar monto_pagado de una transacción
   */
  async updateMontoPagado(transaccionId: number, monto: number): Promise<void> {
    await this.db
      .update(schema.transacciones)
      .set({
        monto_pagado: monto.toFixed(2),
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Actualizar estado de una transacción
   */
  async updateEstado(transaccionId: number, estado: string): Promise<void> {
    await this.db
      .update(schema.transacciones)
      .set({
        estado,
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Actualizar estado_cocina de una transacción
   */
  async updateEstadoCocina(transaccionId: number, estado: string): Promise<void> {
    await this.db
      .update(schema.transacciones)
      .set({
        estado_cocina: estado,
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Obtener transacciones por caja
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

    return transacciones.map((t) => ({
      ...t,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
    }));
  }

  /**
   * Reabrir una transacción cerrada
   */
  async reabrirTransaccion(transaccionId: number): Promise<Transaccion> {
    const transaccion = await this.findOne(transaccionId);

    if (transaccion.estado !== 'cerrado') {
      throw new BadRequestException(
        'Solo se pueden reabrir transacciones cerradas',
      );
    }

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
}

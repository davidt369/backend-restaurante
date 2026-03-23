import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and, asc } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import { CocinaGateway } from '../cocina.gateway';
import { ItemsService } from './items.service';
import { ExtrasService } from './extras.service';

/**
 * CocinaIntegrationService
 * Responsabilidad: El puente con el área de producción
 * 
 * Maneja la integración técnica. Si se usa WebSockets para que la pantalla de
 * la cocina se actualice en tiempo real, la lógica de esa conexión vive aquí,
 * aislada de los cobros o el stock.
 */
@Injectable()
export class CocinaIntegrationService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly cocinaGateway: CocinaGateway,
    private readonly itemsService: ItemsService,
    private readonly extrasService: ExtrasService,
  ) {}

  /**
   * Obtener pedidos pendientes de cocina
   */
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

    // Enriquecer con items y extras
    const resultados = await Promise.all(
      transacciones.map(async (t) => {
        const items = await this.itemsService.getItems(t.id);

        // Enriquecer items con extras
        const itemsConExtras = await Promise.all(
          items.map(async (item) => {
            const extras = await this.extrasService.getExtras(item.id);
            return { ...item, extras };
          }),
        );

        return {
          ...t,
          monto_pendiente: (
            parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
          ).toFixed(2),
          items: itemsConExtras,
        };
      }),
    );

    return resultados;
  }

  /**
   * Marcar orden como completada en cocina
   */
  async completarOrdenCocina(id: number) {
    try {
      const [transaccion] = await this.db
        .select()
        .from(schema.transacciones)
        .where(eq(schema.transacciones.id, id));

      if (!transaccion) {
        throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
      }

      const result = await this.db
        .update(schema.transacciones)
        .set({
          estado_cocina: 'terminado',
          actualizado_en: new Date(),
        })
        .where(eq(schema.transacciones.id, id))
        .returning();

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

  /**
   * Emitir actualización de pedidos a todos los clientes conectados
   */
  async emitirActualizacionCocina(): Promise<void> {
    try {
      const pedidosPendientes = await this.findPendientesCocina();
      this.cocinaGateway.emitPedidosActualizados(pedidosPendientes);
    } catch (error) {
      console.error('Error al emitir actualización de cocina:', error);
    }
  }

  /**
   * Actualizar estado de cocina
   */
  async updateEstadoCocina(
    transaccionId: number,
    estado: 'pendiente' | 'en_preparacion' | 'terminado',
  ): Promise<void> {
    const [transaccion] = await this.db
      .select()
      .from(schema.transacciones)
      .where(eq(schema.transacciones.id, transaccionId));

    if (!transaccion) {
      throw new NotFoundException(
        `Transacción con ID ${transaccionId} no encontrada`,
      );
    }

    await this.db
      .update(schema.transacciones)
      .set({
        estado_cocina: estado,
        actualizado_en: new Date(),
      })
      .where(eq(schema.transacciones.id, transaccionId));
  }

  /**
   * Obtener una orden con sus detalles completos para la cocina
   */
  async getOrdenDetallada(transaccionId: number): Promise<any> {
    const [transaccion] = await this.db
      .select()
      .from(schema.transacciones)
      .where(
        and(
          eq(schema.transacciones.id, transaccionId),
          isNull(schema.transacciones.borrado_en),
        ),
      );

    if (!transaccion) {
      throw new NotFoundException(`Transacción con ID ${transaccionId} no encontrada`);
    }

    const items = await this.itemsService.getItems(transaccionId);

    // Enriquecer items con extras
    const itemsConExtras = await Promise.all(
      items.map(async (item) => {
        const extras = await this.extrasService.getExtras(item.id);
        return { ...item, extras };
      }),
    );

    return {
      ...transaccion,
      items: itemsConExtras,
      monto_pendiente: (
        parseFloat(transaccion.monto_total) - parseFloat(transaccion.monto_pagado)
      ).toFixed(2),
    };
  }
}

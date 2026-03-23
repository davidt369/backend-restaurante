import {
  Injectable,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import { CalculosFinancierosService } from './calculos-financieros.service';

/**
 * EstadosTransaccionService
 * Responsabilidad: Controla el "workflow" de la orden
 * 
 * Una transacción pasa por: Pendiente -> Pagada -> En Cocina -> Completada.
 * Este servicio garantiza que no se salten pasos (por ejemplo, que no se marque
 * como "Completada" una orden que no ha sido pagada).
 */
@Injectable()
export class EstadosTransaccionService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly calculosService: CalculosFinancierosService,
  ) {}

  /**
   * Recalcular y actualizar el estado de una transacción basándose en:
   * - estado_cocina: debe ser 'terminado'
   * - monto_pendiente: debe ser 0
   * Solo cierra si AMBAS condiciones se cumplen.
   */
  async recalcularEstado(
    transaccionId: number,
    montoTotal: number,
    montoPagado: number,
    estadoCocina: string,
  ): Promise<string> {
    const montoPendiente = this.calculosService.calcularMontoPendiente(
      montoTotal,
      montoPagado,
    );

    const pagadoCompleto = this.calculosService.esPagadoCompleto(montoPendiente);
    const cocina_terminada =
      estadoCocina === 'terminado' || estadoCocina === null; // null = sin items de cocina

    let nuevoEstado: string;

    if (pagadoCompleto && cocina_terminada) {
      nuevoEstado = 'cerrado';
    } else if (montoTotal > 0 || estadoCocina === 'pendiente') {
      nuevoEstado = 'abierto';
    } else {
      nuevoEstado = 'pendiente';
    }

    return nuevoEstado;
  }

  /**
   * Actualizar estado de una transacción
   */
  async updateEstado(transaccionId: number, nuevoEstado: string): Promise<void> {
    const transaccion = await this.db
      .select()
      .from(schema.transacciones)
      .where(eq(schema.transacciones.id, transaccionId));

    if (!transaccion || transaccion.length === 0) {
      throw new BadRequestException(`Transacción ${transaccionId} no encontrada`);
    }

    const estadoActual = transaccion[0].estado;

    // Solo actualizar si cambió el estado
    if (estadoActual !== nuevoEstado) {
      await this.db
        .update(schema.transacciones)
        .set({
          estado: nuevoEstado,
          actualizado_en: new Date(),
        })
        .where(eq(schema.transacciones.id, transaccionId));
    }
  }

  /**
   * Validar transición de estado
   */
  esTransicionValida(
    estadoActual: string,
    estadoNuevo: string,
  ): boolean {
    const transiciones: Record<string, string[]> = {
      pendiente: ['abierto', 'cerrado'],
      abierto: ['cerrado', 'pendiente'],
      cerrado: ['abierto'], // Solo se puede reabrir
    };

    return (transiciones[estadoActual] || []).includes(estadoNuevo);
  }

  /**
   * Obtener próximos estados válidos
   */
  getProximosEstados(estadoActual: string): string[] {
    const transiciones: Record<string, string[]> = {
      pendiente: ['abierto', 'cerrado'],
      abierto: ['cerrado', 'pendiente'],
      cerrado: ['abierto'],
    };

    return transiciones[estadoActual] || [];
  }

  /**
   * Validar si una transacción puede ser pagada
   */
  puedePagarse(estadoActual: string): boolean {
    return estadoActual === 'abierto' || estadoActual === 'pendiente';
  }

  /**
   * Validar si una transacción puede ser cerrada
   */
  puedeCerrarse(
    estadoActual: string,
    montoPendiente: number,
    estadoCocina: string,
  ): boolean {
    const pagadoCompleto = this.calculosService.esPagadoCompleto(montoPendiente);
    const cocina_terminada = estadoCocina === 'terminado' || estadoCocina === null;

    return pagadoCompleto && cocina_terminada;
  }

  /**
   * Obtener descripción del estado
   */
  getDescripcionEstado(estado: string): string {
    const descripciones: Record<string, string> = {
      pendiente: 'Pendiente de pago',
      abierto: 'Abierto - En preparación o pendiente de pago',
      cerrado: 'Cerrado - Completado',
    };

    return descripciones[estado] || 'Estado desconocido';
  }
}

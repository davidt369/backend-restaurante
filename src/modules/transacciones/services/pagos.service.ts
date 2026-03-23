import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { CreatePagoDto } from '../dto/create-pago.dto';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';
import type { InferSelectModel } from 'drizzle-orm';

type Pago = InferSelectModel<typeof schema.pagos>;

/**
 * PagosService
 * Responsabilidad: Gestiona la entrada de capital y validaciones financieras
 * 
 * Centraliza los métodos de pago (efectivo, tarjeta, transferencia). Se asegura
 * de que no se pague más de lo debido y calcula el cambio (vuelto) que se debe
 * entregar al cliente.
 */
@Injectable()
export class PagosService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Registrar un pago
   */
  async addPago(
    transaccionId: number,
    createPagoDto: CreatePagoDto,
    usuario_id: string,
    montoPendiente: number,
  ): Promise<any> {
    if (montoPendiente <= 0) {
      throw new BadRequestException(
        'La transacción ya está completamente pagada',
      );
    }

    if (createPagoDto.monto > montoPendiente) {
      throw new BadRequestException(
        `El monto del pago (${createPagoDto.monto}) no puede ser mayor al monto pendiente (${montoPendiente})`,
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

  /**
   * Obtener todos los pagos de una transacción
   */
  async getPagos(transaccionId: number): Promise<Pago[]> {
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

  /**
   * Obtener monto total pagado calculando suma de pagos
   */
  async getTotalPagado(transaccionId: number): Promise<number> {
    const pagos = await this.getPagos(transaccionId);
    return pagos.reduce((sum, pago) => {
      return sum + parseFloat(pago.monto);
    }, 0);
  }

  /**
   * Validar y registrar pago en caja
   */
  async registrarPagoEnCaja(
    cajaId: number,
    metodoPago: 'efectivo' | 'qr',
    monto: number,
  ): Promise<void> {
    const [caja] = await this.db
      .select()
      .from(schema.caja_turno)
      .where(eq(schema.caja_turno.id, cajaId));

    if (!caja) return;

    const ventasEfectivo = parseFloat(caja.ventas_efectivo || '0');
    const ventasQr = parseFloat(caja.ventas_qr || '0');

    if (metodoPago === 'efectivo') {
      await this.db
        .update(schema.caja_turno)
        .set({
          ventas_efectivo: (ventasEfectivo + monto).toFixed(2),
        })
        .where(eq(schema.caja_turno.id, cajaId));
    } else if (metodoPago === 'qr') {
      await this.db
        .update(schema.caja_turno)
        .set({
          ventas_qr: (ventasQr + monto).toFixed(2),
        })
        .where(eq(schema.caja_turno.id, cajaId));
    }
  }
}

import {
  Injectable,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';

/**
 * CalculosFinancierosService
 * Responsabilidad: Es un servicio puramente lógico, sin mucha interacción con DB,
 * enfocado en precisión
 * 
 * Centraliza las fórmulas. Si el día de mañana decides aplicar impuestos (IVA) o
 * descuentos, solo cambias este archivo. Evita que las fórmulas matemáticas estén
 * regadas por todo el código.
 */
@Injectable()
export class CalculosFinancierosService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Calcular subtotal de un item basado en su precio y extras
   */
  async calcularSubtotalItem(itemId: number): Promise<number> {
    // Obtener item
    const [item] = await this.db
      .select()
      .from(schema.detalle_items)
      .where(eq(schema.detalle_items.id, itemId));

    if (!item) return 0;

    // Calcular suma de extras
    const extras = await this.db
      .select()
      .from(schema.detalle_item_extras)
      .where(
        and(
          eq(schema.detalle_item_extras.detalle_item_id, itemId),
          isNull(schema.detalle_item_extras.borrado_en),
        ),
      );

    const sumaExtras = extras.reduce((sum, extra) => {
      const precio = parseFloat(extra.precio ?? '0');
      const cantidad = parseFloat(extra.cantidad ?? '1');
      return sum + precio * cantidad;
    }, 0);

    // Calcular subtotal
    const subtotal_base =
      parseFloat(item.precio_unitario) * parseFloat(item.cantidad);
    const subtotal_total = subtotal_base + sumaExtras;

    return subtotal_total;
  }

  /**
   * Calcular monto total de una transacción sumando todos los items
   */
  async calcularMontoTotal(transaccionId: number): Promise<number> {
    // Sumar todos los subtotales de items activos
    const items = await this.db
      .select()
      .from(schema.detalle_items)
      .where(
        and(
          eq(schema.detalle_items.transaccion_id, transaccionId),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    return items.reduce((sum, item) => {
      return sum + parseFloat(item.subtotal);
    }, 0);
  }

  /**
   * Calcular monto pendiente
   */
  calcularMontoPendiente(montoTotal: number, montoPagado: number): number {
    return montoTotal - montoPagado;
  }

  /**
   * Calcular cambio en un pago en efectivo
   */
  calcularCambio(montoRecibido: number, montoPago: number): number {
    return montoRecibido - montoPago;
  }

  /**
   * Validar si el pago es válido (con tolerancia para decimales)
   */
  esPagadoCompleto(montoPendiente: number): boolean {
    return montoPendiente <= 0.01; // Tolerancia para decimales
  }

  /**
   * Formatear número a decimales (2 posiciones)
   */
  formatearMoneda(numero: number): string {
    return numero.toFixed(2);
  }

  /**
   * Validar monto
   */
  esMontoValido(monto: number): boolean {
    return !isNaN(monto) && monto > 0;
  }

  /**
   * Calcular porcentaje (útil para impuestos futuros)
   */
  calcularPorcentaje(monto: number, porcentaje: number): number {
    return monto * (porcentaje / 100);
  }

  /**
   * Aplicar descuento
   */
  aplicarDescuento(monto: number, descuento: number): number {
    return monto - descuento;
  }

  /**
   * Calcular IVA (cuando se implemente)
   */
  calcularIVA(monto: number, tasaIVA: number = 0): number {
    return this.calcularPorcentaje(monto, tasaIVA);
  }
}

import {
  Injectable,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../drizzle/drizzle.module';

/**
 * CajaReportesService
 * Responsabilidad: Encargado de la rendición de cuentas
 * 
 * Se enfoca en el cierre de caja y en lo que el administrador necesita ver.
 * No afecta la operación de venta, solo consulta datos para generar resúmenes
 * de cuánto dinero debería haber en el cajón físico.
 */
@Injectable()
export class CajaReportesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * 📊 Obtener resumen de items vendidos por caja
   * Agrupa por producto/plato y suma cantidades y subtotales
   */
  async getResumenItemsPorCaja(cajaId: number) {
    // Obtener todos los items de transacciones de esta caja
    const items = await this.db
      .select({
        producto_id: schema.detalle_items.producto_id,
        plato_id: schema.detalle_items.plato_id,
        producto_nombre: schema.productos.nombre,
        plato_nombre: schema.platos.nombre,
        cantidad: schema.detalle_items.cantidad,
        subtotal: schema.detalle_items.subtotal,
      })
      .from(schema.detalle_items)
      .innerJoin(
        schema.transacciones,
        eq(schema.detalle_items.transaccion_id, schema.transacciones.id),
      )
      .leftJoin(
        schema.productos,
        eq(schema.detalle_items.producto_id, schema.productos.id),
      )
      .leftJoin(
        schema.platos,
        eq(schema.detalle_items.plato_id, schema.platos.id),
      )
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
          isNull(schema.detalle_items.borrado_en),
        ),
      );

    // Agrupar y sumar
    const agrupado = new Map<
      string,
      {
        nombre: string;
        cantidad: number;
        total: number;
        tipo: 'producto' | 'plato';
      }
    >();

    for (const item of items) {
      const isProducto = !!item.producto_id;
      const idStr = isProducto ? `p-${item.producto_id}` : `d-${item.plato_id}`;
      const nombre = isProducto
        ? item.producto_nombre || 'Producto desconocido'
        : item.plato_nombre || 'Plato desconocido';

      const cantidad = parseFloat(item.cantidad);
      const subtotal = parseFloat(item.subtotal);

      const actual = agrupado.get(idStr);
      if (actual) {
        actual.cantidad += cantidad;
        actual.total += subtotal;
      } else {
        agrupado.set(idStr, {
          nombre,
          cantidad,
          total: subtotal,
          tipo: isProducto ? 'producto' : 'plato',
        });
      }
    }

    return Array.from(agrupado.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * Obtener resumen de pagos por caja
   */
  async getResumenPagosPorCaja(cajaId: number) {
    const pagos = await this.db
      .select({
        metodo_pago: schema.pagos.metodo_pago,
        monto: schema.pagos.monto,
      })
      .from(schema.pagos)
      .innerJoin(
        schema.transacciones,
        eq(schema.pagos.transaccion_id, schema.transacciones.id),
      )
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
          isNull(schema.pagos.borrado_en),
        ),
      );

    // Agrupar por método de pago
    const agrupado = new Map<
      string,
      {
        metodo: string;
        total: number;
        cantidad: number;
      }
    >();

    for (const pago of pagos) {
      const metodo = pago.metodo_pago;
      const monto = parseFloat(pago.monto);

      const actual = agrupado.get(metodo);
      if (actual) {
        actual.total += monto;
        actual.cantidad += 1;
      } else {
        agrupado.set(metodo, {
          metodo,
          total: monto,
          cantidad: 1,
        });
      }
    }

    return Array.from(agrupado.values());
  }

  /**
   * Obtener total de ingresos de una caja
   */
  async getTotalIngresosCaja(cajaId: number): Promise<number> {
    const resultado = await this.db
      .select({
        total: schema.pagos.monto,
      })
      .from(schema.pagos)
      .innerJoin(
        schema.transacciones,
        eq(schema.pagos.transaccion_id, schema.transacciones.id),
      )
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
          isNull(schema.pagos.borrado_en),
        ),
      );

    return resultado.reduce((sum, row) => {
      return sum + parseFloat(row.total);
    }, 0);
  }

  /**
   * Obtener resumen completo de caja
   */
  async getResumenCompletoCaja(cajaId: number) {
    const itemsVendidos = await this.getResumenItemsPorCaja(cajaId);
    const pagosPorMetodo = await this.getResumenPagosPorCaja(cajaId);
    const totalIngresos = await this.getTotalIngresosCaja(cajaId);

    return {
      cajaId,
      itemsVendidos,
      pagosPorMetodo,
      totalIngresos: totalIngresos.toFixed(2),
      timestamp: new Date(),
    };
  }

  /**
   * Obtener transacciones de una caja para auditoría
   */
  async getTransaccionesCaja(cajaId: number): Promise<any[]> {
    const transacciones = await this.db
      .select({
        id: schema.transacciones.id,
        fecha: schema.transacciones.fecha,
        hora: schema.transacciones.hora,
        monto_total: schema.transacciones.monto_total,
        monto_pagado: schema.transacciones.monto_pagado,
        estado: schema.transacciones.estado,
      })
      .from(schema.transacciones)
      .where(
        and(
          eq(schema.transacciones.caja_id, cajaId),
          isNull(schema.transacciones.borrado_en),
        ),
      );

    return transacciones.map((t) => ({
      ...t,
      monto_pendiente: (
        parseFloat(t.monto_total) - parseFloat(t.monto_pagado)
      ).toFixed(2),
    }));
  }

  /**
   * Generar reporte de cierre de caja
   */
  async generarReporteCierrecaja(cajaId: number) {
    const [caja] = await this.db
      .select()
      .from(schema.caja_turno)
      .where(eq(schema.caja_turno.id, cajaId));

    if (!caja) {
      throw new Error(`Caja ${cajaId} no encontrada`);
    }

    const resumen = await this.getResumenCompletoCaja(cajaId);
    const transacciones = await this.getTransaccionesCaja(cajaId);

    return {
      caja: {
        id: caja.id,
        usuario: caja.usuario_id,
        fecha: caja.fecha,
        hora_apertura: caja.hora_apertura,
        hora_cierre: caja.hora_cierre,
        monto_inicial: caja.monto_inicial,
      },
      resumen,
      transacciones,
      totalTransacciones: transacciones.length,
    };
  }
}

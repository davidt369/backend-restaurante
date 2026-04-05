import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import { isNull, eq, sql, and, desc } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

export interface ActividadItem {
  id: number;
  concepto: string;
  mesa: string | null;
  estado: string;
  monto_total: string;
  hora: string;
}

export interface ChartDataPoint {
  fecha: string;
  ingresos: number;
  gastos: number;
  ganancia: number;
}

export interface DistributionItem {
  nombre: string;
  valor: number;
}

export interface DashboardStats extends BasicStats {
  charts: {
    dailyPerformance: ChartDataPoint[];
    paymentMethods: DistributionItem[];
    topItems: DistributionItem[];
  };
}

export interface BasicStats {
  totalUsuarios: number;
  totalProductos: number;
  totalPlatos: number;
  transaccionesPeriodo: number;
  ordenesAbiertas: number;
  ingresosPeriodo: string;
  gastosPeriodo: string;
  gananciaNeta: string;
  actividadReciente: ActividadItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    const hoy = new Date().toISOString().slice(0, 10);
    const start = startDate || hoy;
    const end = endDate || hoy;

    // 1. Basic Counts (Always total active)
    const [usuariosResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.usuarios)
      .where(isNull(schema.usuarios.borrado_en));

    const [productosResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.productos)
      .where(isNull(schema.productos.borrado_en));

    const [platosResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.platos)
      .where(isNull(schema.platos.borrado_en));

    // 2. Transacciones del periodo
    const [transaccionesResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.transacciones)
      .where(
        and(
          isNull(schema.transacciones.borrado_en),
          sql`${schema.transacciones.fecha} BETWEEN ${start} AND ${end}`,
        ),
      );

    // 3. Órdenes abiertas (en el periodo o actualmente dependiente de la lógica de negocio, usaremos periodo aquí)
    const [ordenesAbiertasResult] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.transacciones)
      .where(
        and(
          isNull(schema.transacciones.borrado_en),
          sql`${schema.transacciones.fecha} BETWEEN ${start} AND ${end}`,
          sql`${schema.transacciones.estado} IN ('pendiente', 'abierto')`,
        ),
      );

    // 4. Ingresos (Solo cerradas)
    const [ingresosResult] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.transacciones.monto_total}), 0)::numeric(10,2)::text`,
      })
      .from(schema.transacciones)
      .where(
        and(
          isNull(schema.transacciones.borrado_en),
          sql`${schema.transacciones.fecha} BETWEEN ${start} AND ${end}`,
          eq(schema.transacciones.estado, 'cerrado'),
        ),
      );

    // 5. Gastos del periodo
    const [gastosResult] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.gastos_caja.monto}), 0)::numeric(10,2)::text`,
      })
      .from(schema.gastos_caja)
      .innerJoin(
        schema.caja_turno,
        eq(schema.gastos_caja.caja_id, schema.caja_turno.id),
      )
      .where(
        and(
          isNull(schema.gastos_caja.borrado_en),
          sql`${schema.caja_turno.fecha} BETWEEN ${start} AND ${end}`,
        ),
      );

    // 6. Actividad reciente (últimas 10 del periodo)
    const actividadRaw = await this.db
      .select({
        id: schema.transacciones.id,
        concepto: schema.transacciones.concepto,
        mesa: schema.transacciones.mesa,
        estado: schema.transacciones.estado,
        monto_total: schema.transacciones.monto_total,
        hora: schema.transacciones.hora,
      })
      .from(schema.transacciones)
      .where(
        and(
          isNull(schema.transacciones.borrado_en),
          sql`${schema.transacciones.fecha} BETWEEN ${start} AND ${end}`,
        ),
      )
      .orderBy(desc(schema.transacciones.hora))
      .limit(10);

    const actividadReciente: ActividadItem[] = actividadRaw.map((t) => ({
      id: t.id,
      concepto: t.concepto,
      mesa: t.mesa ?? null,
      estado: t.estado ?? 'pendiente',
      monto_total: t.monto_total ?? '0.00',
      hora: t.hora ? t.hora.toISOString() : new Date().toISOString(),
    }));

    // 7. CHART DATA: Rendimiento Diario
    const dailyPerfRaw = await this.db.execute(sql`
      WITH dates AS (
        SELECT generate_series(${start}::date, ${end}::date, '1 day'::interval)::date as d
      ),
      ingresos_diarios AS (
        SELECT fecha, SUM(monto_total) as total_ingresos, COUNT(*)::int as total_ventas
        FROM transacciones
        WHERE borrado_en IS NULL AND estado = 'cerrado' 
        AND fecha BETWEEN ${start} AND ${end}
        GROUP BY fecha
      ),
      gastos_diarios AS (
        SELECT c.fecha, SUM(g.monto) as total_gastos
        FROM gastos_caja g
        JOIN caja_turno c ON g.caja_id = c.id
        WHERE g.borrado_en IS NULL 
        AND c.fecha BETWEEN ${start} AND ${end}
        GROUP BY c.fecha
      )
      SELECT 
        d::text as fecha,
        COALESCE(i.total_ingresos, 0)::numeric(10,2) as ingresos,
        COALESCE(g.total_gastos, 0)::numeric(10,2) as gastos,
        COALESCE(i.total_ventas, 0)::int as ventas
      FROM dates d
      LEFT JOIN ingresos_diarios i ON d.d = i.fecha
      LEFT JOIN gastos_diarios g ON d.d = g.fecha
      ORDER BY d
    `);

    const dailyPerformance: ChartDataPoint[] = dailyPerfRaw.rows.map((row: any) => ({
      fecha: row.fecha,
      ingresos: parseFloat(row.ingresos),
      gastos: parseFloat(row.gastos),
      ganancia: parseFloat(row.ingresos) - parseFloat(row.gastos),
      ventas: parseInt(row.ventas),
    }));

    // 8. CHART DATA: Métodos de Pago
    const paymentMethodsRaw = await this.db.execute(sql`
      SELECT 
        p.metodo_pago as nombre,
        SUM(p.monto)::numeric(10,2) as valor
      FROM pagos p
      JOIN transacciones t ON p.transaccion_id = t.id
      WHERE p.borrado_en IS NULL AND t.borrado_en IS NULL AND t.fecha BETWEEN ${start} AND ${end}
      GROUP BY p.metodo_pago
    `);

    const paymentMethods: DistributionItem[] = paymentMethodsRaw.rows.map((row: any) => ({
      nombre: (row.nombre as string).toUpperCase(),
      valor: parseFloat(row.valor),
    }));

    // 9. CHART DATA: Top Items Vendidos
    const topItemsRaw = await this.db.execute(sql`
      SELECT 
        COALESCE(pr.nombre, pl.nombre) as nombre,
        SUM(di.cantidad)::numeric(10,2) as valor
      FROM detalle_items di
      JOIN transacciones t ON di.transaccion_id = t.id
      LEFT JOIN productos pr ON di.producto_id = pr.id
      LEFT JOIN platos pl ON di.plato_id = pl.id
      WHERE di.borrado_en IS NULL AND t.borrado_en IS NULL AND t.fecha BETWEEN ${start} AND ${end}
      GROUP BY 1
      ORDER BY valor DESC
      LIMIT 5
    `);

    const topItems: DistributionItem[] = topItemsRaw.rows.map((row: any) => ({
      nombre: row.nombre as string,
      valor: parseFloat(row.valor),
    }));

    const ingresosFinal = parseFloat(ingresosResult.total || '0');
    const gastosFinal = parseFloat(gastosResult.total || '0');

    return {
      totalUsuarios: usuariosResult.count,
      totalProductos: productosResult.count,
      totalPlatos: platosResult.count,
      transaccionesPeriodo: transaccionesResult.count,
      ordenesAbiertas: ordenesAbiertasResult.count,
      ingresosPeriodo: ingresosFinal.toFixed(2),
      gastosPeriodo: gastosFinal.toFixed(2),
      gananciaNeta: (ingresosFinal - gastosFinal).toFixed(2),
      actividadReciente,
      charts: {
        dailyPerformance,
        paymentMethods,
        topItems,
      },
    };
  }
}

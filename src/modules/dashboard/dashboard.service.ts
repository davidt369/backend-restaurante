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

export interface DashboardStats {
    totalUsuarios: number;
    totalProductos: number;
    totalPlatos: number;
    transaccionesHoy: number;
    ordenesAbiertas: number;
    ingresosHoy: string;
    ventaTotalBrutaHoy: string;
    actividadReciente: ActividadItem[];
}

@Injectable()
export class DashboardService {
    constructor(
        @Inject(DRIZZLE_DB)
        private readonly db: NodePgDatabase<typeof schema>,
    ) { }

    async getStats(): Promise<DashboardStats> {
        // Fecha de hoy en zona horaria configurada (America/La_Paz via process.env.TZ)
        const hoy = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

        // Conteo de usuarios activos
        const [usuariosResult] = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.usuarios)
            .where(isNull(schema.usuarios.borrado_en));

        // Conteo de productos activos
        const [productosResult] = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.productos)
            .where(isNull(schema.productos.borrado_en));

        // Conteo de platos activos
        const [platosResult] = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.platos)
            .where(isNull(schema.platos.borrado_en));

        // Conteo de transacciones de hoy
        const [transaccionesHoyResult] = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.transacciones)
            .where(
                and(
                    isNull(schema.transacciones.borrado_en),
                    eq(schema.transacciones.fecha, hoy),
                ),
            );

        // Conteo de órdenes abiertas/pendientes hoy
        const [ordenesAbiertasResult] = await this.db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.transacciones)
            .where(
                and(
                    isNull(schema.transacciones.borrado_en),
                    eq(schema.transacciones.fecha, hoy),
                    sql`${schema.transacciones.estado} IN ('pendiente', 'abierto')`,
                ),
            );

        // Ingresos de hoy (solo transacciones cerradas)
        const [ingresosResult] = await this.db
            .select({
                total: sql<string>`COALESCE(SUM(${schema.transacciones.monto_total}), 0)::numeric(10,2)::text`,
            })
            .from(schema.transacciones)
            .where(
                and(
                    isNull(schema.transacciones.borrado_en),
                    eq(schema.transacciones.fecha, hoy),
                    eq(schema.transacciones.estado, 'cerrado'),
                ),
            );

        // Actividad reciente: últimas 5 transacciones del día
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
                    eq(schema.transacciones.fecha, hoy),
                ),
            )
            .orderBy(desc(schema.transacciones.hora))
            .limit(5);

        const actividadReciente: ActividadItem[] = actividadRaw.map((t) => ({
            id: t.id,
            concepto: t.concepto,
            mesa: t.mesa ?? null,
            estado: t.estado ?? 'pendiente',
            monto_total: t.monto_total ?? '0.00',
            hora: t.hora ? t.hora.toISOString() : new Date().toISOString(),
        }));

        // Venta total bruta de hoy (todas las transacciones no borradas)
        const [ventaTotalResult] = await this.db
            .select({
                total: sql<string>`COALESCE(SUM(${schema.transacciones.monto_total}), 0)::numeric(10,2)::text`,
            })
            .from(schema.transacciones)
            .where(
                and(
                    isNull(schema.transacciones.borrado_en),
                    eq(schema.transacciones.fecha, hoy),
                ),
            );

        return {
            totalUsuarios: usuariosResult.count,
            totalProductos: productosResult.count,
            totalPlatos: platosResult.count,
            transaccionesHoy: transaccionesHoyResult.count,
            ordenesAbiertas: ordenesAbiertasResult.count,
            ingresosHoy: ingresosResult.total ?? '0.00',
            ventaTotalBrutaHoy: ventaTotalResult.total ?? '0.00',
            actividadReciente,
        };
    }
}

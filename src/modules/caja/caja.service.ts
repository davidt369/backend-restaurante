import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, InferSelectModel } from 'drizzle-orm';

import * as schema from '../../db/schema';
import { caja_turno, gastos_caja } from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';
import { AbrirCajaDto, RegistrarGastoDto, CerrarCajaDto } from './dto';

// Tipos inferidos de Drizzle
type CajaTurno = InferSelectModel<typeof caja_turno>;
type GastoCaja = InferSelectModel<typeof gastos_caja>;

// Interfaces exportadas para respuestas
export interface CajaTurnoResponse {
  id: number;
  fecha: string;
  hora_apertura: Date | null;
  hora_cierre: Date | null;
  usuario_id: string | null;
  monto_inicial: number;
  b200: number | null;
  b100: number | null;
  b50: number | null;
  b20: number | null;
  b10: number | null;
  b5: number | null;
  m2: number | null;
  m1: number | null;
  m050: number | null;
  m020: number | null;
  m010: number | null;
  ventas_efectivo: number;
  ventas_qr: number;
  total_salidas: number;
  cerrada: boolean | null;
  cierre_obs: string | null;
}

export interface GastoCajaResponse {
  id: number;
  caja_id: number;
  usuario_id: string | null;
  descripcion: string;
  metodo_pago: string;
  monto: number;
  creado_en: Date | null;
  actualizado_en: Date | null;
  borrado_en: Date | null;
}

export interface ResumenCierre {
  caja: CajaTurnoResponse;
  resumen: {
    monto_inicial: number;
    ventas_efectivo: number;
    ventas_qr: number;
    gastos_efectivo: number;
    gastos_qr: number;
    efectivo_esperado: number;
    total_qr: number;
    total_del_dia: number;
    total_gastos: number;
  };
  gastos: GastoCajaResponse[];
}

export interface CierreCajaResponse {
  caja_id: number;
  fecha: string;
  monto_contado: number;
  efectivo_esperado: number;
  diferencia: number;
  estado_diferencia: 'exacto' | 'sobrante' | 'faltante';
  resumen_completo: ResumenCierre;
}

interface Denominaciones {
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  b10: number;
  b5: number;
  m2: number;
  m1: number;
  m050: number;
  m020: number;
  m010: number;
}

/**
 * 🧠 Servicio de gestión de caja
 * Controla:
 * - Efectivo físico (billetes y monedas)
 * - Dinero digital (QR)
 * - Registro contable del sistema
 */
@Injectable()
export class CajaService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * 🟢 Abrir caja del día
   * Registra el efectivo inicial con el que se abre la caja
   */
  async abrirCaja(
    dto: AbrirCajaDto,
    usuarioId: string,
  ): Promise<CajaTurnoResponse> {
    // Validar que no haya una caja abierta
    const cajaAbierta = await this.obtenerCajaAbierta();
    if (cajaAbierta) {
      throw new ConflictException(
        'Ya existe una caja abierta. Debe cerrarla antes de abrir una nueva.',
      );
    }

    // Calcular el monto inicial basado en el conteo de billetes y monedas
    const montoInicial = this.calcularMonto({
      b200: dto.b200 ?? 0,
      b100: dto.b100 ?? 0,
      b50: dto.b50 ?? 0,
      b20: dto.b20 ?? 0,
      b10: dto.b10 ?? 0,
      b5: dto.b5 ?? 0,
      m2: dto.m2 ?? 0,
      m1: dto.m1 ?? 0,
      m050: dto.m050 ?? 0,
      m020: dto.m020 ?? 0,
      m010: dto.m010 ?? 0,
    });

    // Obtener fecha de hoy en formato YYYY-MM-DD (Bolivia)
    const fechaHoy = new Date().toLocaleDateString('en-CA'); // formato ISO

    // Crear el registro de caja
    const [nuevaCaja] = await this.db
      .insert(caja_turno)
      .values({
        fecha: fechaHoy,
        usuario_id: usuarioId,
        monto_inicial: montoInicial.toString(),
        b200: dto.b200 ?? 0,
        b100: dto.b100 ?? 0,
        b50: dto.b50 ?? 0,
        b20: dto.b20 ?? 0,
        b10: dto.b10 ?? 0,
        b5: dto.b5 ?? 0,
        m2: dto.m2 ?? 0,
        m1: dto.m1 ?? 0,
        m050: dto.m050 ?? 0,
        m020: dto.m020 ?? 0,
        m010: dto.m010 ?? 0,
      })
      .returning();

    if (!nuevaCaja) {
      throw new BadRequestException('Error al crear la caja');
    }

    return this.convertirCajaAResponse(nuevaCaja);
  }

  /**
   * 📊 Obtener caja actual (abierta)
   */
  async obtenerCajaAbierta(): Promise<CajaTurnoResponse | null> {
    const [caja] = await this.db
      .select()
      .from(caja_turno)
      .where(eq(caja_turno.cerrada, false))
      .limit(1);

    if (!caja) {
      return null;
    }

    return this.convertirCajaAResponse(caja);
  }

  /**
   * 💰 Registrar gasto de caja
   * Puede ser en efectivo (sale dinero físico) o QR (pago digital)
   */
  async registrarGasto(
    dto: RegistrarGastoDto,
    usuarioId: string,
  ): Promise<GastoCajaResponse> {
    // Validar que exista una caja abierta
    const cajaAbierta = await this.obtenerCajaAbierta();
    if (!cajaAbierta) {
      throw new BadRequestException(
        'No hay una caja abierta. Debe abrir la caja primero.',
      );
    }

    // Registrar el gasto
    const [gasto] = await this.db
      .insert(gastos_caja)
      .values({
        caja_id: cajaAbierta.id,
        usuario_id: usuarioId,
        descripcion: dto.descripcion,
        metodo_pago: dto.metodo_pago,
        monto: dto.monto.toString(),
      })
      .returning();

    if (!gasto) {
      throw new BadRequestException('Error al registrar el gasto');
    }

    // Actualizar el total de salidas en la caja
    const nuevoTotalSalidas = cajaAbierta.total_salidas + dto.monto;

    await this.db
      .update(caja_turno)
      .set({
        total_salidas: nuevoTotalSalidas.toString(),
      })
      .where(eq(caja_turno.id, cajaAbierta.id));

    return this.convertirGastoAResponse(gasto);
  }

  /**
   * 📋 Obtener resumen de caja para el cierre
   * Calcula:
   * - Efectivo esperado = monto_inicial + ventas_efectivo - gastos_efectivo
   * - Total QR = ventas_qr - gastos_qr
   * - Total del día = ventas_efectivo + ventas_qr
   */
  async obtenerResumenCierre(): Promise<ResumenCierre> {
    const cajaAbierta = await this.obtenerCajaAbierta();
    if (!cajaAbierta) {
      throw new BadRequestException('No hay una caja abierta para cerrar.');
    }

    // Obtener gastos de la caja actual
    const gastosDb = await this.db
      .select()
      .from(gastos_caja)
      .where(eq(gastos_caja.caja_id, cajaAbierta.id));

    // Convertir gastos a response con tipos correctos
    const gastos: GastoCajaResponse[] = gastosDb.map((g) =>
      this.convertirGastoAResponse(g),
    );

    // Calcular gastos separados por método de pago
    const gastosEfectivo = gastos
      .filter((g) => g.metodo_pago === 'efectivo')
      .reduce((sum, g) => sum + g.monto, 0);

    const gastosQr = gastos
      .filter((g) => g.metodo_pago === 'qr')
      .reduce((sum, g) => sum + g.monto, 0);

    // Cálculos principales
    const montoInicial = cajaAbierta.monto_inicial;
    const ventasEfectivo = cajaAbierta.ventas_efectivo;
    const ventasQr = cajaAbierta.ventas_qr;

    const efectivoEsperado = montoInicial + ventasEfectivo - gastosEfectivo;
    const totalQr = ventasQr - gastosQr;
    const totalDelDia = ventasEfectivo + ventasQr;

    return {
      caja: cajaAbierta,
      resumen: {
        monto_inicial: montoInicial,
        ventas_efectivo: ventasEfectivo,
        ventas_qr: ventasQr,
        gastos_efectivo: gastosEfectivo,
        gastos_qr: gastosQr,
        efectivo_esperado: efectivoEsperado,
        total_qr: totalQr,
        total_del_dia: totalDelDia,
        total_gastos: gastosEfectivo + gastosQr,
      },
      gastos,
    };
  }

  /**
   * 🔴 Cerrar caja
   * Compara el efectivo contado vs el esperado
   */
  async cerrarCaja(dto: CerrarCajaDto): Promise<CierreCajaResponse> {
    const cajaAbierta = await this.obtenerCajaAbierta();
    if (!cajaAbierta) {
      throw new BadRequestException('No hay una caja abierta para cerrar.');
    }

    // Obtener resumen antes de cerrar
    const resumen = await this.obtenerResumenCierre();

    // Calcular el monto contado físicamente
    const montoContado = this.calcularMonto(dto);

    // Calcular diferencia
    const diferencia = montoContado - resumen.resumen.efectivo_esperado;

    // Cerrar la caja
    await this.db
      .update(caja_turno)
      .set({
        cerrada: true,
        hora_cierre: new Date(),
        cierre_obs: dto.cierre_obs,
      })
      .where(eq(caja_turno.id, cajaAbierta.id));

    return {
      caja_id: cajaAbierta.id,
      fecha: cajaAbierta.fecha,
      monto_contado: montoContado,
      efectivo_esperado: resumen.resumen.efectivo_esperado,
      diferencia,
      estado_diferencia:
        diferencia === 0 ? 'exacto' : diferencia > 0 ? 'sobrante' : 'faltante',
      resumen_completo: resumen,
    };
  }

  /**
   * 📜 Obtener historial de cajas
   */
  async obtenerHistorial(limit = 10): Promise<CajaTurnoResponse[]> {
    const cajas = await this.db
      .select()
      .from(caja_turno)
      .orderBy(desc(caja_turno.fecha))
      .limit(limit);

    return cajas.map((caja) => this.convertirCajaAResponse(caja));
  }

  /**
   * � Obtener historial de todos los gastos
   */
  async obtenerHistorialGastos(limit = 50): Promise<GastoCajaResponse[]> {
    const gastos = await this.db
      .select()
      .from(gastos_caja)
      .orderBy(desc(gastos_caja.creado_en))
      .limit(limit);

    return gastos.map((gasto) => this.convertirGastoAResponse(gasto));
  }

  /**
   * �🔢 Calcular monto basado en denominaciones
   * Método auxiliar privado
   */
  private calcularMonto(conteo: Denominaciones): number {
    return (
      conteo.b200 * 200 +
      conteo.b100 * 100 +
      conteo.b50 * 50 +
      conteo.b20 * 20 +
      conteo.b10 * 10 +
      conteo.b5 * 5 +
      conteo.m2 * 2 +
      conteo.m1 * 1 +
      conteo.m050 * 0.5 +
      conteo.m020 * 0.2 +
      conteo.m010 * 0.1
    );
  }

  /**
   * Convertir CajaTurno de DB a Response
   */
  private convertirCajaAResponse(caja: CajaTurno): CajaTurnoResponse {
    return {
      id: caja.id,
      fecha: caja.fecha,
      hora_apertura: caja.hora_apertura,
      hora_cierre: caja.hora_cierre,
      usuario_id: caja.usuario_id,
      monto_inicial: parseFloat(caja.monto_inicial ?? '0'),
      b200: caja.b200,
      b100: caja.b100,
      b50: caja.b50,
      b20: caja.b20,
      b10: caja.b10,
      b5: caja.b5,
      m2: caja.m2,
      m1: caja.m1,
      m050: caja.m050,
      m020: caja.m020,
      m010: caja.m010,
      ventas_efectivo: parseFloat(caja.ventas_efectivo ?? '0'),
      ventas_qr: parseFloat(caja.ventas_qr ?? '0'),
      total_salidas: parseFloat(caja.total_salidas ?? '0'),
      cerrada: caja.cerrada,
      cierre_obs: caja.cierre_obs,
    };
  }

  /**
   * Convertir GastoCaja de DB a Response
   */
  private convertirGastoAResponse(gasto: GastoCaja): GastoCajaResponse {
    return {
      id: gasto.id,
      caja_id: gasto.caja_id,
      usuario_id: gasto.usuario_id,
      descripcion: gasto.descripcion,
      metodo_pago: gasto.metodo_pago,
      monto: parseFloat(gasto.monto ?? '0'),
      creado_en: gasto.creado_en,
      actualizado_en: gasto.actualizado_en,
      borrado_en: gasto.borrado_en,
    };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { CajaController } from './caja.controller';
import {
  CajaService,
  CajaTurnoResponse,
  ResumenCierre,
  CierreCajaResponse,
} from './caja.service';

describe('CajaController', () => {
  let controller: CajaController;
  let mockCajaService: Partial<CajaService>;

  const mockCajaResponse: CajaTurnoResponse = {
    id: 1,
    fecha: '2026-03-30',
    hora_apertura: new Date(),
    hora_cierre: null,
    usuario_id: 'usr_test',
    monto_inicial: 500,
    b200: 2,
    b100: 1,
    b50: 0,
    b20: 0,
    b10: 0,
    b5: 0,
    m2: 0,
    m1: 0,
    m050: 0,
    m020: 0,
    m010: 0,
    ventas_efectivo: 0,
    ventas_qr: 0,
    total_salidas: 0,
    cerrada: false,
    cierre_obs: null,
  };

  const mockResumen: ResumenCierre = {
    caja: mockCajaResponse,
    resumen: {
      monto_inicial: 500,
      ventas_efectivo: 1000,
      ventas_qr: 500,
      gastos_efectivo: 100,
      gastos_qr: 50,
      efectivo_esperado: 1400,
      total_qr: 450,
      total_del_dia: 1500,
      total_gastos: 150,
    },
    gastos: [],
  };

  const mockCierre: CierreCajaResponse = {
    caja_id: 1,
    fecha: '2026-03-30',
    monto_contado: 1380,
    efectivo_esperado: 1400,
    diferencia: -20,
    estado_diferencia: 'faltante',
    resumen_completo: mockResumen,
  };

  beforeEach(async () => {
    mockCajaService = {
      abrirCaja: jest.fn().mockResolvedValue(mockCajaResponse),
      obtenerCajaAbierta: jest.fn().mockResolvedValue(mockCajaResponse),
      registrarGasto: jest.fn().mockResolvedValue({
        id: 1,
        caja_id: 1,
        usuario_id: 'usr_test',
        descripcion: 'Test',
        metodo_pago: 'efectivo',
        monto: 50,
        creado_en: new Date(),
        actualizado_en: new Date(),
        borrado_en: null,
      }),
      obtenerResumenCierre: jest.fn().mockResolvedValue(mockResumen),
      obtenerDetalleCaja: jest.fn().mockResolvedValue(mockResumen),
      cerrarCaja: jest.fn().mockResolvedValue(mockCierre),
      guardarArqueo: jest.fn().mockResolvedValue(undefined),
      obtenerHistorial: jest.fn().mockResolvedValue([mockCajaResponse]),
      obtenerHistorialGastos: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CajaController],
      providers: [
        {
          provide: CajaService,
          useValue: mockCajaService,
        },
      ],
    }).compile();

    controller = module.get<CajaController>(CajaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('abrirCaja', () => {
    it('should open caja with valid data', async () => {
      const dto = { b200: 2, b100: 1 };
      const user = { id: 'usr_test' };

      const result = await controller.abrirCaja(dto, user);

      expect(mockCajaService.abrirCaja).toHaveBeenCalledWith(dto, user.id);
      expect(result).toEqual(mockCajaResponse);
    });
  });

  describe('obtenerCajaAbierta', () => {
    it('should return current caja', async () => {
      const result = await controller.obtenerCajaAbierta();

      expect(mockCajaService.obtenerCajaAbierta).toHaveBeenCalled();
      expect(result).toEqual(mockCajaResponse);
    });
  });

  describe('registrarGasto', () => {
    it('should register a gasto', async () => {
      const dto = { descripcion: 'Test', metodo_pago: 'efectivo' as const, monto: 50 };
      const user = { id: 'usr_test' };

      const result = await controller.registrarGasto(dto, user);

      expect(mockCajaService.registrarGasto).toHaveBeenCalledWith(dto, user.id);
      expect(result).toBeDefined();
    });
  });

  describe('obtenerResumenCierre', () => {
    it('should return closing summary', async () => {
      const result = await controller.obtenerResumenCierre();

      expect(mockCajaService.obtenerResumenCierre).toHaveBeenCalled();
      expect(result).toEqual(mockResumen);
    });
  });

  describe('cerrarCaja', () => {
    it('should close caja and return cierre info', async () => {
      const dto = {
        b200: 2,
        b100: 1,
        b50: 0,
        b20: 0,
        b10: 0,
        b5: 0,
        m2: 0,
        m1: 0,
        m050: 0,
        m020: 0,
        m010: 0,
        cierre_obs: 'Test close',
      };

      const result = await controller.cerrarCaja(dto);

      expect(mockCajaService.cerrarCaja).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCierre);
    });

    it('should calculate exact difference when amounts match', async () => {
      const exactCierre: CierreCajaResponse = {
        ...mockCierre,
        monto_contado: 1400,
        efectivo_esperado: 1400,
        diferencia: 0,
        estado_diferencia: 'exacto',
      };

      (mockCajaService.cerrarCaja as jest.Mock).mockResolvedValueOnce(
        exactCierre,
      );

      const dto = {
        b200: 4,
        b100: 4,
        b50: 0,
        b20: 0,
        b10: 0,
        b5: 0,
        m2: 0,
        m1: 0,
        m050: 0,
        m020: 0,
        m010: 0,
      };

      const result = await controller.cerrarCaja(dto);

      expect(result.estado_diferencia).toBe('exacto');
    });
  });

  describe('obtenerHistorial', () => {
    it('should return Caja history', async () => {
      const result = await controller.obtenerHistorial(10);

      expect(mockCajaService.obtenerHistorial).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockCajaResponse]);
    });

    it('should use default limit when not provided', async () => {
      const result = await controller.obtenerHistorial();

      expect(mockCajaService.obtenerHistorial).toHaveBeenCalled();
      expect(result).toEqual([mockCajaResponse]);
    });
  });

  describe('obtenerDetalleCaja', () => {
    it('should return caja detail by id', async () => {
      const result = await controller.obtenerDetalleCaja(1);

      expect(mockCajaService.obtenerDetalleCaja).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResumen);
    });
  });
});

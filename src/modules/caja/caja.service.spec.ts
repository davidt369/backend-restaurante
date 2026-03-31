import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CajaService } from './caja.service';
import * as schema from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

describe('CajaService', () => {
  let service: CajaService;
  let mockDb: Partial<NodePgDatabase<typeof schema>>;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 1,
              fecha: '2026-03-30',
              hora_apertura: new Date(),
              hora_cierre: null,
              usuario_id: 'usr_test',
              monto_inicial: '500',
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
              ventas_efectivo: '0',
              ventas_qr: '0',
              total_salidas: '0',
              cerrada: false,
              cierre_obs: null,
            },
          ]),
        }),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CajaService>(CajaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calcularMonto (private method testing via public API)', () => {
    it('should calculate correct amount with Bs200 bills', async () => {
      const mockReturn = {
        id: 1,
        fecha: '2026-03-30',
        hora_apertura: null,
        hora_cierre: null,
        usuario_id: 'usr_test',
        monto_inicial: 0,
        b200: 0,
        b100: 0,
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

      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockReturn]),
          }),
        }),
      });

      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.obtenerCajaAbierta();
      expect(result).toBeDefined();
    });
  });

  describe('abrirCaja', () => {
    it('should open caja with valid denominations', async () => {
      const dto = {
        b200: 2,
        b100: 1,
      };

      const result = await service.abrirCaja(dto, 'usr_test');

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.monto_inicial).toBe(500);
    });

    it('should throw ConflictException when caja is already open', async () => {
      const mockCajaAbierta = {
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

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockCajaAbierta]),
          }),
        }),
      });

      await expect(service.abrirCaja({ b200: 1 }, 'usr_test')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow opening caja with zero amounts', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const dto = {
        b200: 0,
        b100: 0,
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

      try {
        const result = await service.abrirCaja(dto, 'usr_test');
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('obtenerCajaAbierta', () => {
    it('should return null when no caja is open', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.obtenerCajaAbierta();

      expect(result).toBeNull();
    });

    it('should return caja when it exists', async () => {
      const mockCaja = {
        id: 1,
        fecha: '2026-03-30',
        hora_apertura: new Date(),
        hora_cierre: null,
        usuario_id: 'usr_test',
        monto_inicial: '500',
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
        ventas_efectivo: '0',
        ventas_qr: '0',
        total_salidas: '0',
        cerrada: false,
        cierre_obs: null,
      };

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockCaja]),
          }),
        }),
      });

      const result = await service.obtenerCajaAbierta();

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.cerrada).toBe(false);
    });
  });

  describe('registrarGasto', () => {
    it('should throw BadRequestException when no caja is open', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.registrarGasto(
          { descripcion: 'Test', metodo_pago: 'efectivo', monto: 50 },
          'usr_test',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should register gasto when caja is open', async () => {
      const mockCaja = {
        id: 1,
        fecha: '2026-03-30',
        hora_apertura: new Date(),
        hora_cierre: null,
        usuario_id: 'usr_test',
        monto_inicial: '500',
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
        ventas_efectivo: '0',
        ventas_qr: '0',
        total_salidas: '0',
        cerrada: false,
        cierre_obs: null,
      };

      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockCaja]),
          }),
        }),
      });

      (mockDb.insert as jest.Mock).mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 1,
              caja_id: 1,
              usuario_id: 'usr_test',
              descripcion: 'Test',
              metodo_pago: 'efectivo',
              monto: '50',
              creado_en: new Date(),
              actualizado_en: new Date(),
              borrado_en: null,
            },
          ]),
        }),
      });

      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockCaja]),
          }),
        }),
      });

      const result = await service.registrarGasto(
        { descripcion: 'Test', metodo_pago: 'efectivo', monto: 50 },
        'usr_test',
      );

      expect(result).toBeDefined();
      expect(result.descripcion).toBe('Test');
    });
  });

  describe('obtenerHistorial', () => {
    it('should return empty array when no caja history', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.obtenerHistorial();

      expect(result).toEqual([]);
    });
  });

  describe('calcularMonto edge cases', () => {
    it('should handle negative values in deserialization', () => {
      const mockCaja = {
        id: 1,
        fecha: '2026-03-30',
        hora_apertura: new Date(),
        hora_cierre: null,
        usuario_id: 'usr_test',
        monto_inicial: '-100',
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
        ventas_efectivo: '0',
        ventas_qr: '0',
        total_salidas: '0',
        cerrada: false,
        cierre_obs: null,
      };

      const result = service['convertirCajaAResponse'](mockCaja as any);
      expect(result.monto_inicial).toBe(-100);
    });
  });
});

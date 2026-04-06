import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TransaccionesService } from './transacciones.service';
import { CajaService } from '../caja/caja.service';
import { CocinaGateway } from './cocina.gateway';
import * as schema from '../../db/schema';
import { DRIZZLE_DB } from '../../drizzle/drizzle.module';

describe('TransaccionesService', () => {
  let service: TransaccionesService;
  let mockDb: Partial<NodePgDatabase<typeof schema>>;
  let mockCajaService: Partial<CajaService>;
  let mockCocinaGateway: Partial<CocinaGateway>;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([
            {
              id: 1,
              nro_reg: 100,
              monto_total: '100.00',
              monto_pagado: '20.00',
              borrado_en: null,
            },
          ]),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 1,
              nro_reg: 101,
              monto_total: '0',
              monto_pagado: '0',
            },
          ]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      }),
    };

    mockCajaService = {
      obtenerCajaAbierta: jest.fn().mockResolvedValue({ id: 1 }),
    };

    mockCocinaGateway = {
      emitPedidosActualizados: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransaccionesService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
        {
          provide: CajaService,
          useValue: mockCajaService,
        },
        {
          provide: CocinaGateway,
          useValue: mockCocinaGateway,
        },
      ],
    }).compile();

    service = module.get<TransaccionesService>(TransaccionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a transaction with monto_pendiente calculated', async () => {
      const result = await service.findOne(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.monto_pendiente).toBe('80.00'); // 100.00 - 20.00
    });

    it('should throw NotFoundException when transaction is not found', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      const dto = {
        nro_reg: 101,
        tipo: 'venta' as const,
        concepto: 'Venta test',
        mesa: '1',
        cliente: 'Juan',
        estado: 'abierto' as const,
      };

      // Mock findOne for the return
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 1,
        ...dto,
        monto_total: '0',
        monto_pagado: '0',
        monto_pendiente: '0.00'
      });
      
      // Mock findPendientesCocina
      jest.spyOn(service as any, 'findPendientesCocina').mockResolvedValue([]);

      const result = await service.create(dto, 'usr_test');
      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});

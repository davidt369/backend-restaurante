import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { App } from 'supertest/types';

describe('CajaController (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let cajeroToken: string;

  const adminCredentials = {
    nombre_usuario: 'admin',
    contrasena: 'Admin123!',
  };

  const cajeroCredentials = {
    nombre_usuario: 'cajero1',
    contrasena: 'Cajero123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should login as admin', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(adminCredentials)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          adminToken = res.body.access_token;
        });
    });

    it('should login as cajero', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(cajeroCredentials)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          cajeroToken = res.body.access_token;
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'invalid', contrasena: 'wrong' })
        .expect(401);
    });
  });

  describe('Caja Endpoints (requires auth)', () => {
    describe('GET /caja/actual', () => {
      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/caja/actual')
          .expect(401);
      });

      it('should get current caja as admin', () => {
        return request(app.getHttpServer())
          .get('/caja/actual')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should get current caja as cajero', () => {
        return request(app.getHttpServer())
          .get('/caja/actual')
          .set('Authorization', `Bearer ${cajeroToken}`)
          .expect(200);
      });
    });

    describe('POST /caja/abrir', () => {
      it('should require authentication', () => {
        return request(app.getHttpServer())
          .post('/caja/abrir')
          .send({ b200: 2, b100: 1 })
          .expect(401);
      });

      it('should open caja as admin', () => {
        return request(app.getHttpServer())
          .post('/caja/abrir')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ b200: 2, b100: 1, b50: 0, b20: 0, b10: 0, b5: 0, m2: 0, m1: 0, m050: 0, m020: 0, m010: 0 })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('monto_inicial');
            expect(res.body.cerrada).toBe(false);
          });
      });

      it('should reject opening caja when one is already open', () => {
        return request(app.getHttpServer())
          .post('/caja/abrir')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ b200: 1 })
          .expect(409);
      });

      it('should reject invalid data (negative values)', () => {
        return request(app.getHttpServer())
          .post('/caja/abrir')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ b200: -1 })
          .expect(400);
      });
    });

    describe('POST /caja/gastos', () => {
      it('should register gasto as admin', () => {
        return request(app.getHttpServer())
          .post('/caja/gastos')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            descripcion: 'Compra de gas',
            metodo_pago: 'efectivo',
            monto: 50,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.descripcion).toBe('Compra de gas');
            expect(res.body.monto).toBe(50);
          });
      });

      it('should reject when no caja is open', async () => {
        await request(app.getHttpServer())
          .post('/caja/cerrar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            b200: 2, b100: 1, b50: 0, b20: 0, b10: 0, b5: 0,
            m2: 0, m1: 0, m050: 0, m020: 0, m010: 0,
          });

        return request(app.getHttpServer())
          .post('/caja/gastos')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            descripcion: 'Test',
            metodo_pago: 'efectivo',
            monto: 10,
          })
          .expect(400);
      });
    });

    describe('GET /caja/resumen', () => {
      it('should get closing summary', () => {
        return request(app.getHttpServer())
          .post('/caja/abrir')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ b200: 2, b100: 1 })
          .then(() => {
            return request(app.getHttpServer())
              .get('/caja/resumen')
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200)
              .expect((res) => {
                expect(res.body).toHaveProperty('resumen');
                expect(res.body.resumen).toHaveProperty('efectivo_esperado');
              });
          });
      });
    });

    describe('POST /caja/cerrar', () => {
      it('should close caja and calculate difference', () => {
        return request(app.getHttpServer())
          .post('/caja/cerrar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
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
            cierre_obs: 'Cierre de prueba',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('diferencia');
            expect(res.body).toHaveProperty('estado_diferencia');
            expect(['exacto', 'sobrante', 'faltante']).toContain(
              res.body.estado_diferencia,
            );
          });
      });
    });

    describe('GET /caja/historial', () => {
      it('should get caja history', () => {
        return request(app.getHttpServer())
          .get('/caja/historial')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body));
          });
      });

      it('should respect limit query param', () => {
        return request(app.getHttpServer())
          .get('/caja/historial?limit=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('GET /caja/gastos/historial', () => {
      it('should get gastos history', () => {
        return request(app.getHttpServer())
          .get('/caja/gastos/historial')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body));
          });
      });
    });
  });
});
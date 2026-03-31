import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { App } from 'supertest/types';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

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

  describe('POST /auth/login', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          nombre_usuario: 'admin',
          contrasena: 'Admin123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body.usuario).toHaveProperty('id');
          expect(res.body.usuario.nombre_usuario).toBe('admin');
          expect(res.body.usuario.rol).toBe('admin');
        });
    });

    it('should login cajero with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          nombre_usuario: 'cajero1',
          contrasena: 'Cajero123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body.usuario.rol).toBe('cajero');
        });
    });

    it('should reject invalid username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          nombre_usuario: 'nonexistent',
          contrasena: 'anypassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Credenciales inválidas');
        });
    });

    it('should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          nombre_usuario: 'admin',
          contrasena: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Credenciales inválidas');
        });
    });

    it('should reject missing username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          contrasena: 'Admin123!',
        })
        .expect(400);
    });

    it('should reject missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          nombre_usuario: 'admin',
        })
        .expect(400);
    });
  });

  describe('GET /auth/profile', () => {
    it('should get profile with valid JWT', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'admin', contrasena: 'Admin123!' });

      const token = loginRes.body.access_token;

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.nombre_usuario).toBe('admin');
          expect(res.body.rol).toBe('admin');
        });
    });

    it('should reject request without JWT', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should reject request with invalid JWT', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed JWT', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .expect(401);
    });
  });

  describe('JWT Token', () => {
    it('should contain correct payload in token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'admin', contrasena: 'Admin123!' });

      const token = res.body.access_token;

      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );

      expect(decoded.sub).toBeDefined();
      expect(decoded.nombre_usuario).toBe('admin');
      expect(decoded.rol).toBe('admin');
    });

    it('should have different tokens for different users', async () => {
      const adminRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'admin', contrasena: 'Admin123!' });

      const cajeroRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'cajero1', contrasena: 'Cajero123!' });

      expect(adminRes.body.access_token).not.toBe(cajeroRes.body.access_token);
    });
  });

  describe('Role-based access control', () => {
    it('admin should be able to access caja endpoints', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'admin', contrasena: 'Admin123!' });

      const token = loginRes.body.access_token;

      return request(app.getHttpServer())
        .get('/caja/actual')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('cajero should be able to access caja endpoints', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nombre_usuario: 'cajero1', contrasena: 'Cajero123!' });

      const token = loginRes.body.access_token;

      return request(app.getHttpServer())
        .get('/caja/actual')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
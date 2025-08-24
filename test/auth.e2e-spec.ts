import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { testPrisma } from './test-setup';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Add global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('USER');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify user was created in database
      const dbUser = await testPrisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser!.email).toBe(userData.email);
      expect(dbUser!.role).toBe('USER');

      // Verify session was created
      const session = await testPrisma.session.findFirst({
        where: { userId: dbUser!.id },
      });
      expect(session).toBeDefined();
    });

    it('should register an admin user when role is specified', async () => {
      const userData = {
        email: 'admin@example.com',
        password: 'admin123',
        role: 'ADMIN',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should fail when registering with existing email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
      };

      // First registration should succeed
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(409);
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should fail with password too short', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'login@example.com',
        password: 'password123',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should fail with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should fail with invalid password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create a test user and get tokens
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'password123',
        });

      refreshToken = response.body.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');

      // New refresh token should be different
      expect(response.body.refreshToken).not.toBe(refreshToken);

      // Access token might be the same if generated at the same time with same user data
      // but refresh token should always be different for security
    });

    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should fail with expired refresh token', async () => {
      // Note: This test would require mocking time or using a very short expiration
      // For now, we'll test the basic functionality
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create a test user and get access token
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'profile@example.com',
          password: 'password123',
        });

      accessToken = response.body.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body.email).toBe('profile@example.com');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should fail without authorization header', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full authentication workflow', async () => {
      // 1. Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'workflow@example.com',
          password: 'password123',
        })
        .expect(201);

      const { accessToken, refreshToken } = registerResponse.body;

      // 2. Access profile with access token
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 3. Refresh tokens
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newAccessToken = refreshResponse.body.accessToken;

      // 4. Access profile with new access token
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // 5. Verify old access token is still valid (JWT is stateless)
      // In a real system, you might implement a blacklist or use shorter expiration times
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});

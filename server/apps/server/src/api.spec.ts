import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { WordBookController } from './word-book/word-book.controller';
import { WordBookService } from './word-book/word-book.service';
import { ResponseService } from '@libs/shared/response/response.service';
import { PrismaService } from '@libs/shared/prisma/prisma.service';
import { InterceptorInterceptor } from '@libs/shared/interceptor/interceptor';
import { InterceptorExceptionFilter } from '@libs/shared/interceptor/exceptionFilter';
import { AuthService } from './auth/auth.service';

const password = 'e10adc3949ba59abbe56e057f20f883e';
const publicUser = {
  id: 'user-1',
  name: '学习者',
  phone: '13800138000',
  wordNumber: 0,
  dayNumber: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  lastLoginAt: new Date('2026-01-01T00:00:00Z'),
};

describe('chapter-six dual-token API contract', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const database = {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    wordBook: { findMany: jest.fn(), count: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'chapter-six-test-secret', signOptions: { expiresIn: 10 } })],
      controllers: [UserController, WordBookController],
      providers: [
        UserService,
        WordBookService,
        ResponseService,
        AuthService,
        { provide: PrismaService, useValue: database },
      ],
    }).compile();
    jwt = moduleRef.get(JwtService);
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new InterceptorInterceptor());
    app.useGlobalFilters(new InterceptorExceptionFilter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => app.close());

  it('serves versioned word queries with the course response envelope', async () => {
    database.wordBook.findMany.mockResolvedValue([]);
    database.wordBook.count.mockResolvedValue(0);
    const result = await request(app.getHttpServer())
      .get('/api/v1/word-book?page=2&pageSize=12&cet4=true')
      .set('Authorization', `Bearer ${jwt.sign({ userId: publicUser.id, tokenType: 'access' })}`)
      .expect(200);
    expect(result.body).toMatchObject({
      success: true,
      code: 200,
      message: 'success',
      data: { list: [], total: 0 },
      path: '/api/v1/word-book?page=2&pageSize=12&cet4=true',
    });
    expect(database.wordBook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { word: undefined, cet4: true },
        skip: 12,
        take: 12,
      }),
    );
  });

  it('returns course POST status 201 and serializes public registration fields', async () => {
    database.user.findUnique.mockResolvedValue(null);
    database.user.create.mockResolvedValue(publicUser);
    const result = await request(app.getHttpServer())
      .post('/api/v1/user/register')
      .send({ name: publicUser.name, phone: publicUser.phone, password })
      .expect(201);
    expect(result.body).toMatchObject({
      success: true,
      code: 200,
      message: 'success',
      data: { id: publicUser.id, createdAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(result.body.data).not.toHaveProperty('password');
    expect(jwt.verify(result.body.data.token.accessToken)).toMatchObject({ userId: publicUser.id, tokenType: 'access' });
    expect(jwt.verify(result.body.data.token.refreshToken)).toMatchObject({ userId: publicUser.id, tokenType: 'refresh' });
    expect(database.user.create.mock.calls[0][0].select).not.toHaveProperty(
      'password',
    );
  });

  it('logs in using the submitted MD5 value and omits password from the selected result', async () => {
    database.user.findUnique.mockResolvedValue({ ...publicUser, password });
    database.user.update.mockResolvedValue(publicUser);
    const result = await request(app.getHttpServer())
      .post('/api/v1/user/login')
      .send({ phone: publicUser.phone, password })
      .expect(201);
    expect(result.body).toMatchObject({
      success: true,
      code: 200,
      data: { id: publicUser.id, lastLoginAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(result.body.data).not.toHaveProperty('password');
    expect(jwt.verify(result.body.data.token.accessToken)).toMatchObject({ userId: publicUser.id, tokenType: 'access' });
    expect(jwt.verify(result.body.data.token.refreshToken)).toMatchObject({ userId: publicUser.id, tokenType: 'refresh' });
  });

  it('preserves the course business-error envelope and POST status', async () => {
    database.user.findUnique.mockResolvedValue(null);
    const result = await request(app.getHttpServer())
      .post('/api/v1/user/login')
      .send({ phone: publicUser.phone, password })
      .expect(201);
    expect(result.body).toMatchObject({
      success: true,
      code: 500,
      message: '手机号不存在',
      data: null,
    });
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it('returns a new token pair when the refresh token is valid', async () => {
    database.user.findUnique.mockResolvedValue(publicUser);
    const result = await request(app.getHttpServer())
      .post('/api/v1/user/refresh-token')
      .send({ refreshToken: jwt.sign({ userId: publicUser.id, tokenType: 'refresh' }, { expiresIn: '7d' }) })
      .expect(201);
    expect(result.body).toMatchObject({ success: true, code: 200 });
    expect(result.body.data).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(jwt.verify(result.body.data.accessToken)).toMatchObject({ userId: publicUser.id, tokenType: 'access' });
    expect(jwt.verify(result.body.data.refreshToken)).toMatchObject({ userId: publicUser.id, tokenType: 'refresh' });
  });

  it.each(['invalid', 'access', 'expired'])('rejects %s refresh credentials', async (kind) => {
    const refreshToken = kind === 'invalid' ? 'invalid-token' : jwt.sign(
      { userId: publicUser.id, tokenType: kind === 'access' ? 'access' : 'refresh' },
      { expiresIn: kind === 'expired' ? -1 : 60 },
    );
    const result = await request(app.getHttpServer())
      .post('/api/v1/user/refresh-token')
      .send({ refreshToken })
      .expect(201);
    expect(result.body).toMatchObject({ success: true, code: 500, data: null });
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['missing', 'refresh', 'expired'])('protects word queries from %s access credentials', async (kind) => {
    let query = request(app.getHttpServer()).get('/api/v1/word-book');
    if (kind !== 'missing') {
      query = query.set('Authorization', `Bearer ${jwt.sign(
        { userId: publicUser.id, tokenType: kind === 'refresh' ? 'refresh' : 'access' },
        { expiresIn: kind === 'expired' ? -1 : 60 },
      )}`);
    }
    const result = await query.expect(401);
    expect(result.body).toMatchObject({ success: false, code: 401 });
    expect(database.wordBook.findMany).not.toHaveBeenCalled();
  });

  it('does not expose a user-list route in the chapter-six controller', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/user')
      .expect(404);
    expect(result.body).toMatchObject({ success: false, code: 404 });
  });
});

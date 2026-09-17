import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { MonitorsScheduler } from './../src/monitors/monitors.scheduler.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MonitorsScheduler)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    await prisma.checkResult.deleteMany();
    await prisma.monitor.deleteMany();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('POST /monitors without admin key returns 401', async () => {
    await request(app.getHttpServer())
      .post('/monitors')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(401);
  });

  it('POST /monitors with invalid data returns 400', async () => {
    await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'not-a-url',
        intervalMinutes: 0,
      })
      .expect(400);
  });

  it('POST /monitors creates a monitor', async () => {
    const response = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Google',
      url: 'https://www.google.com',
      intervalMinutes: 5,
      active: true,
    });
  });

  it('GET /monitors returns monitors', async () => {
    await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/monitors')
      .expect(200);

    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toMatchObject({
      name: 'Google',
      url: 'https://www.google.com',
      intervalMinutes: 5,
      active: true,
    });
  });
  it('PATCH /monitors/:id updates a monitor', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    const monitorId = created.body.id;

    const response = await request(app.getHttpServer())
      .patch(`/monitors/${monitorId}`)
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        intervalMinutes: 10,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: monitorId,
      name: 'Google',
      intervalMinutes: 10,
    });
  });

  it('DELETE /monitors/:id deletes a monitor', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    const monitorId = created.body.id;

    await request(app.getHttpServer())
      .delete(`/monitors/${monitorId}`)
      .set('X-Admin-Key', 'test-admin-key')
      .expect(200);

    const monitors = await request(app.getHttpServer())
      .get('/monitors')
      .expect(200);

    expect(monitors.body).toHaveLength(0);
  });

  it('GET /monitors/:id returns a monitor', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    const monitorId = created.body.id;

    const response = await request(app.getHttpServer())
      .get(`/monitors/${monitorId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: monitorId,
      name: 'Google',
      url: 'https://www.google.com',
      intervalMinutes: 5,
      active: true,
    });
  });

  it('GET /monitors/:id returns 404 for a nonexistent monitor', async () => {
    await request(app.getHttpServer()).get('/monitors/999999').expect(404);
  });

  it('POST /monitors rejects unknown properties', async () => {
    await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
        randomProperty: 'should not be allowed',
      })
      .expect(400);
  });

  it('PATCH /monitors/:id rejects invalid data', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    const monitorId = created.body.id;

    await request(app.getHttpServer())
      .patch(`/monitors/${monitorId}`)
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        intervalMinutes: 0,
      })
      .expect(400);
  });

  it('PATCH /monitors/:id without admin key returns 401', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/monitors/${created.body.id}`)
      .send({
        intervalMinutes: 10,
      })
      .expect(401);
  });

  it('PATCH /monitors/:id returns 404 for a nonexistent monitor', async () => {
    await request(app.getHttpServer())
      .patch('/monitors/999999')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        intervalMinutes: 10,
      })
      .expect(404);
  });

  it('DELETE /monitors/:id without admin key returns 401', async () => {
    const created = await request(app.getHttpServer())
      .post('/monitors')
      .set('X-Admin-Key', 'test-admin-key')
      .send({
        name: 'Google',
        url: 'https://www.google.com',
        intervalMinutes: 5,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/monitors/${created.body.id}`)
      .expect(401);
  });

  it('DELETE /monitors/:id returns 404 for a nonexistent monitor', async () => {
    await request(app.getHttpServer())
      .delete('/monitors/999999')
      .set('X-Admin-Key', 'test-admin-key')
      .expect(404);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MonitorsService } from './monitors.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MonitorsService', () => {
  let service: MonitorsService;

  const prismaMock = {
    monitor: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    checkResult: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<MonitorsService>(MonitorsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('records an up result when fetch succeeds', async () => {
    prismaMock.monitor.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test',
      url: 'https://8.8.8.8',
      intervalMinutes: 5,
      active: true,
      createdAt: new Date(),
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    prismaMock.checkResult.create.mockResolvedValue({
      id: 1,
      monitorId: 1,
      isUp: true,
      statusCode: 200,
      responseTimeMs: 10,
      error: null,
      checkedAt: new Date(),
    });

    await service.check(1);

    expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
      data: {
        monitorId: 1,
        isUp: true,
        statusCode: 200,
        responseTimeMs: expect.any(Number),
      },
    });
  });

  it('records a down result when fetch fails', async () => {
    prismaMock.monitor.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test',
      url: 'https://8.8.8.8',
      intervalMinutes: 5,
      active: true,
      createdAt: new Date(),
    });

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));

    prismaMock.checkResult.create.mockResolvedValue({
      id: 1,
      monitorId: 1,
      isUp: false,
      statusCode: null,
      responseTimeMs: 10,
      error: 'Network failure',
      checkedAt: new Date(),
    });

    await service.check(1);

    expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
      data: {
        monitorId: 1,
        isUp: false,
        statusCode: null,
        responseTimeMs: expect.any(Number),
        error: 'Network failure',
      },
    });
  });

  it('records a down result when the website returns an error status', async () => {
    prismaMock.monitor.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test',
      url: 'https://8.8.8.8',
      intervalMinutes: 5,
      active: true,
      createdAt: new Date(),
    });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    prismaMock.checkResult.create.mockResolvedValue({
      id: 1,
      monitorId: 1,
      isUp: false,
      statusCode: 500,
      responseTimeMs: 10,
      error: null,
      checkedAt: new Date(),
    });

    await service.check(1);

    expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
      data: {
        monitorId: 1,
        isUp: false,
        statusCode: 500,
        responseTimeMs: expect.any(Number),
      },
    });
  });

  it('throws NotFoundException when the monitor does not exist', async () => {
    prismaMock.monitor.findUnique.mockResolvedValue(null);

    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.check(999)).rejects.toThrow(NotFoundException);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.checkResult.create).not.toHaveBeenCalled();
  });

  it('checks a monitor with no previous check history', async () => {
    prismaMock.monitor.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test',
        url: 'https://8.8.8.8',
        intervalMinutes: 5,
        active: true,
        createdAt: new Date(),
        checkResults: [],
      },
    ]);

    const checkSpy = jest.spyOn(service, 'check').mockResolvedValue({
      id: 1,
      monitorId: 1,
      isUp: true,
      statusCode: 200,
      responseTimeMs: 10,
      error: null,
      checkedAt: new Date(),
    });

    await service.checkDueMonitors();

    expect(checkSpy).toHaveBeenCalledWith(1);
  });
  it('checks a monitor when its interval has elapsed', async () => {
    const now = new Date('2026-09-17T12:10:00.000Z');

    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

    prismaMock.monitor.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test',
        url: 'https://8.8.8.8',
        intervalMinutes: 5,
        active: true,
        createdAt: new Date(),
        checkResults: [
          {
            id: 1,
            monitorId: 1,
            isUp: true,
            statusCode: 200,
            responseTimeMs: 10,
            error: null,
            checkedAt: new Date('2026-09-17T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const checkSpy = jest.spyOn(service, 'check').mockResolvedValue({
      id: 2,
      monitorId: 1,
      isUp: true,
      statusCode: 200,
      responseTimeMs: 10,
      error: null,
      checkedAt: now,
    });

    await service.checkDueMonitors();

    expect(checkSpy).toHaveBeenCalledWith(1);
  });
  it('does not check a monitor before its interval has elapsed', async () => {
    const now = new Date('2026-09-17T12:03:00.000Z');

    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

    prismaMock.monitor.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test',
        url: 'https://8.8.8.8',
        intervalMinutes: 5,
        active: true,
        createdAt: new Date(),
        checkResults: [
          {
            id: 1,
            monitorId: 1,
            isUp: true,
            statusCode: 200,
            responseTimeMs: 10,
            error: null,
            checkedAt: new Date('2026-09-17T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const checkSpy = jest.spyOn(service, 'check');

    await service.checkDueMonitors();

    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('continues checking other monitors if one check fails', async () => {
    prismaMock.monitor.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'First',
        url: 'https://8.8.8.8',
        intervalMinutes: 5,
        active: true,
        createdAt: new Date(),
        checkResults: [],
      },
      {
        id: 2,
        name: 'Second',
        url: 'https://8.8.8.8',
        intervalMinutes: 5,
        active: true,
        createdAt: new Date(),
        checkResults: [],
      },
    ]);

    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const checkSpy = jest
      .spyOn(service, 'check')
      .mockRejectedValueOnce(new Error('Check failed'))
      .mockResolvedValueOnce({
        id: 2,
        monitorId: 2,
        isUp: true,
        statusCode: 200,
        responseTimeMs: 10,
        error: null,
        checkedAt: new Date(),
      });

    await service.checkDueMonitors();

    expect(checkSpy).toHaveBeenCalledTimes(2);
    expect(checkSpy).toHaveBeenNthCalledWith(1, 1);
    expect(checkSpy).toHaveBeenNthCalledWith(2, 2);
  });

  it('records a down result when DNS resolution fails', async () => {
    prismaMock.monitor.findUnique.mockResolvedValue({
      id: 1,
      name: 'Broken DNS',
      url: 'http://does-not-exist.invalid',
      intervalMinutes: 5,
      active: true,
      createdAt: new Date(),
    });

    const fetchSpy = jest.spyOn(global, 'fetch');

    prismaMock.checkResult.create.mockResolvedValue({
      id: 1,
      monitorId: 1,
      isUp: false,
      statusCode: null,
      responseTimeMs: 10,
      error: 'DNS failure',
      checkedAt: new Date(),
    });

    await service.check(1);

    expect(fetchSpy).not.toHaveBeenCalled();

    expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
      data: {
        monitorId: 1,
        isUp: false,
        statusCode: null,
        responseTimeMs: expect.any(Number),
        error: expect.any(String),
      },
    });
  });
});

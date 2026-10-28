import { Test, TestingModule } from '@nestjs/testing';
import dns from 'node:dns/promises';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
    jest.spyOn(dns, 'lookup').mockRejectedValue(new Error('DNS failure'));
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
  describe('reliability', () => {
    const monitor = {
      id: 1,
      name: 'Test',
      url: 'https://8.8.8.8',
      intervalMinutes: 5,
      active: true,
      createdAt: new Date(),
    };

    beforeEach(() => {
      prismaMock.monitor.findUnique.mockResolvedValue(monitor);
      prismaMock.checkResult.create.mockResolvedValue({ id: 1 });
    });

    it('rejects an overlapping check and allows the next check after completion', async () => {
      let finish!: (response: Response) => void;
      let started!: () => void;
      const fetching = new Promise<void>((resolve) => {
        started = resolve;
      });
      const response = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        started();
        return response;
      });
      const first = service.check(1);
      await fetching;
      await expect(service.check(1)).rejects.toThrow(ConflictException);
      expect(prismaMock.checkResult.create).not.toHaveBeenCalled();
      finish(new Response(null, { status: 200 }));
      await first;
      await service.check(1);
      expect(prismaMock.checkResult.create).toHaveBeenCalledTimes(2);
    });

    it('does not record a down result for a database failure and releases the running flag', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(null, { status: 200 }));
      prismaMock.checkResult.create.mockRejectedValueOnce(
        new Error('Database unavailable'),
      );
      await expect(service.check(1)).rejects.toThrow('Database unavailable');
      expect(prismaMock.checkResult.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.checkResult.create.mock.calls[0][0].data.isUp).toBe(
        true,
      );
      await service.check(1);
      expect(prismaMock.checkResult.create).toHaveBeenCalledTimes(2);
    });

    it('records redirects explicitly without following them', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(null, { status: 302 }));
      await service.check(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        monitor.url,
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isUp: false,
          statusCode: 302,
          error: 'Redirect not followed',
        }),
      });
    });

    it('stops waiting for DNS when the shared deadline expires', async () => {
      const controller = new AbortController();
      jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
      let started!: () => void;
      const resolving = new Promise<void>((resolve) => {
        started = resolve;
      });
      jest.spyOn(dns, 'lookup').mockImplementation(() => {
        started();
        return new Promise<never>(() => {});
      });
      const fetchSpy = jest.spyOn(global, 'fetch');
      const checking = service.check(1);
      await resolving;
      controller.abort(new Error('Check timed out'));
      await checking;
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isUp: false,
          statusCode: null,
          error: 'Check timed out',
        }),
      });
    });

    it('uses the same deadline for DNS and HTTP rather than starting a second timeout', async () => {
      const controller = new AbortController();
      const timeoutSpy = jest
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(controller.signal);
      let started!: () => void;
      const fetching = new Promise<void>((resolve) => {
        started = resolve;
      });
      jest.spyOn(global, 'fetch').mockImplementation((_url, options) => {
        expect(options?.signal).toBe(controller.signal);
        started();
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(controller.signal.reason),
            { once: true },
          );
        });
      });
      const checking = service.check(1);
      await fetching;
      controller.abort(new Error('Check timed out'));
      await checking;
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
      expect(timeoutSpy).toHaveBeenCalledWith(5000);
      expect(prismaMock.checkResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isUp: false,
          error: 'Check timed out',
        }),
      });
    });

    it('rejects unsafe URLs and releases the running flag', async () => {
      prismaMock.monitor.findUnique.mockResolvedValue({
        ...monitor,
        url: 'http://localhost',
      });
      await expect(service.check(1)).rejects.toThrow(BadRequestException);
      expect(prismaMock.checkResult.create).not.toHaveBeenCalled();
      prismaMock.monitor.findUnique.mockResolvedValue(monitor);
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(null, { status: 200 }));
      await service.check(1);
      expect(prismaMock.checkResult.create).toHaveBeenCalledTimes(1);
    });

    it('does not start overlapping scheduler batches', async () => {
      let finish!: (monitors: never[]) => void;
      prismaMock.monitor.findMany.mockReturnValue(
        new Promise<never[]>((resolve) => {
          finish = resolve;
        }),
      );
      const first = service.checkDueMonitors();
      await service.checkDueMonitors();
      expect(prismaMock.monitor.findMany).toHaveBeenCalledTimes(1);
      finish([]);
      await first;
      await service.checkDueMonitors();
      expect(prismaMock.monitor.findMany).toHaveBeenCalledTimes(2);
    });

    it('can run the scheduler again after a database failure', async () => {
      prismaMock.monitor.findMany
        .mockRejectedValueOnce(new Error('Database unavailable'))
        .mockResolvedValue([]);
      await expect(service.checkDueMonitors()).rejects.toThrow(
        'Database unavailable',
      );
      await service.checkDueMonitors();
      expect(prismaMock.monitor.findMany).toHaveBeenCalledTimes(2);
    });

    it('skips a scheduled check while a manual check is running', async () => {
      let finish!: (response: Response) => void;
      let started!: () => void;
      const fetching = new Promise<void>((resolve) => {
        started = resolve;
      });
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        started();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      });
      const checking = service.check(1);
      await fetching;
      prismaMock.monitor.findMany.mockResolvedValue([
        { ...monitor, checkResults: [] },
      ]);
      await service.checkDueMonitors();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      finish(new Response(null, { status: 200 }));
      await checking;
      expect(prismaMock.checkResult.create).toHaveBeenCalledTimes(1);
    });
  });
});

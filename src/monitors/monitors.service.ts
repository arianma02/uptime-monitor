import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { assertSafeUrl } from './url-safety.js';

@Injectable()
export class MonitorsService {
  private readonly runningChecks = new Set<number>();
  private checkingDueMonitors = false;

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.monitor.findMany();
  }

  create(data: CreateMonitorDto) {
    return this.prisma.monitor.create({
      data,
    });
  }

  async findOne(id: number) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor;
  }

  async update(id: number, data: UpdateMonitorDto) {
    await this.findOne(id);

    return this.prisma.monitor.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.monitor.delete({
      where: { id },
    });
  }

  async check(id: number) {
    if (this.runningChecks.has(id)) {
      throw new ConflictException(
        'A check is already running for this monitor',
      );
    }

    this.runningChecks.add(id);
    try {
      return await this.runCheck(id);
    } finally {
      this.runningChecks.delete(id);
    }
  }

  private async runCheck(id: number) {
    const monitor = await this.findOne(id);
    const start = performance.now();
    const signal = AbortSignal.timeout(5000);
    let isUp = false;
    let statusCode: number | null = null;
    let errorMessage: string | undefined;

    try {
      await assertSafeUrl(monitor.url, signal);
      signal.throwIfAborted();
      const response = await fetch(monitor.url, {
        signal,
        redirect: 'manual',
      });
      isUp = response.ok;
      statusCode = response.status;
      if (statusCode >= 300 && statusCode < 400) {
        errorMessage = 'Redirect not followed';
      }
      await response.body?.cancel();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      isUp = false;
      statusCode = null;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    return this.prisma.checkResult.create({
      data: {
        monitorId: monitor.id,
        isUp,
        statusCode,
        responseTimeMs: Math.round(performance.now() - start),
        ...(errorMessage ? { error: errorMessage } : {}),
      },
    });
  }

  async findChecks(id: number, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return this.prisma.checkResult.findMany({
      where: {
        monitorId: id,
      },
      orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async checkDueMonitors(): Promise<void> {
    if (this.checkingDueMonitors) return;
    this.checkingDueMonitors = true;
    try {
      await this.runDueMonitors();
    } finally {
      this.checkingDueMonitors = false;
    }
  }

  private async runDueMonitors(): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({
      where: {
        active: true,
      },
      include: {
        checkResults: {
          orderBy: {
            checkedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const now = Date.now();

    for (const monitor of monitors) {
      const lastCheck = monitor.checkResults[0];

      // Check immediately if there is no history, otherwise wait until the monitor's interval has elapsed.
      const isDue =
        !lastCheck ||
        now >= lastCheck.checkedAt.getTime() + monitor.intervalMinutes * 60_000;

      if (!isDue || this.runningChecks.has(monitor.id)) {
        continue;
      }

      // Keep processing other monitors even if one scheduled check fails.
      try {
        await this.check(monitor.id);
      } catch (error) {
        console.error(
          `Scheduled check failed for monitor ${monitor.id}`,
          error,
        );
      }
    }
  }
}

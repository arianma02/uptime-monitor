import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { assertSafeUrl } from './url-safety.js';

@Injectable()
export class MonitorsService {
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
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    await assertSafeUrl(monitor.url);

    const start = performance.now();

    try {
      const response = await fetch(monitor.url, {
        signal: AbortSignal.timeout(5000),
        // Don't automatically follow redirects to an unchecked destination.
        redirect: 'manual',
      });

      const responseTimeMs = Math.round(performance.now() - start);

      return this.prisma.checkResult.create({
        data: {
          monitorId: monitor.id,
          isUp: response.ok,
          statusCode: response.status,
          responseTimeMs,
        },
      });
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - start);

      return this.prisma.checkResult.create({
        data: {
          monitorId: monitor.id,
          isUp: false,
          statusCode: null,
          responseTimeMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async findChecks(id: number) {
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
      orderBy: {
        checkedAt: 'desc',
      },
    });
  }

  async checkDueMonitors(): Promise<void> {
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

      if (!isDue) {
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

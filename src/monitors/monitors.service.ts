import { PrismaService } from '../prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.monitor.findMany();
  }

  create(data: { name: string; url: string; intervalMinutes?: number }) {
    return this.prisma.monitor.create({
      data,
    });
  }
  findOne(id: number) {
    return this.prisma.monitor.findUnique({
      where: { id },
    });
  }

  update(
    id: number,
    data: {
      name?: string;
      url?: string;
      intervalMinutes?: number;
      active?: boolean;
    },
  ) {
    return this.prisma.monitor.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
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

    const start = performance.now();

    try {
      const response = await fetch(monitor.url, {
        signal: AbortSignal.timeout(5000),
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
}

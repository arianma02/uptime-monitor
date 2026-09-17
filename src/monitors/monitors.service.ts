import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}

import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminKeyGuard } from './admin-key.guard';
import { MonitorsScheduler } from './scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [MonitorsController],
  providers: [MonitorsService, AdminKeyGuard, MonitorsScheduler],
})
export class MonitorsModule {}

import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminKeyGuard } from './admin-key.guard';

@Module({
  imports: [PrismaModule],
  controllers: [MonitorsController],
  providers: [MonitorsService, AdminKeyGuard],
})
export class MonitorsModule {}

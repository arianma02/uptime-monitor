import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorsService } from './monitors.service.js';

@Injectable()
export class MonitorsScheduler {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleMonitoring(): Promise<void> {
    await this.monitorsService.checkDueMonitors();
  }
}

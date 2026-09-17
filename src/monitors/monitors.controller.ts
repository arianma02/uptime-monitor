import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { AdminKeyGuard } from './admin-key.guard.js';

@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  findAll() {
    return this.monitorsService.findAll();
  }

  @Post()
  @UseGuards(AdminKeyGuard)
  create(@Body() data: CreateMonitorDto) {
    return this.monitorsService.create(data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monitorsService.findOne(Number(id));
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  update(@Param('id') id: string, @Body() data: UpdateMonitorDto) {
    return this.monitorsService.update(Number(id), data);
  }

  @Delete(':id')
  @UseGuards(AdminKeyGuard)
  remove(@Param('id') id: string) {
    return this.monitorsService.remove(Number(id));
  }

  @Post(':id/check')
  @UseGuards(AdminKeyGuard)
  check(@Param('id') id: string) {
    return this.monitorsService.check(Number(id));
  }

  @Get(':id/checks')
  findChecks(@Param('id') id: string) {
    return this.monitorsService.findChecks(Number(id));
  }
}

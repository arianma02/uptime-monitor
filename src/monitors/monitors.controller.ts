import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.monitorsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateMonitorDto,
  ) {
    return this.monitorsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AdminKeyGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.monitorsService.remove(id);
  }

  @Post(':id/check')
  @UseGuards(AdminKeyGuard)
  check(@Param('id', ParseIntPipe) id: number) {
    return this.monitorsService.check(id);
  }

  @Get(':id/checks')
  findChecks(@Param('id', ParseIntPipe) id: number) {
    return this.monitorsService.findChecks(id);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return this.appService.getRoot();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  getHealth() {
    return this.appService.getHealth();
  }
}


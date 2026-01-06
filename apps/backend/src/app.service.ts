import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      message: 'QAPlus Backend API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}


import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { ThrottlerExceptionFilter } from './common/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 確保上傳目錄存在
  const chatbotLogosDir = join(process.cwd(), 'uploads', 'chatbot-logos');
  if (!fs.existsSync(chatbotLogosDir)) {
    fs.mkdirSync(chatbotLogosDir, { recursive: true });
    console.log(`📁 Created uploads directory: ${chatbotLogosDir}`);
  }

  const faqImagesDir = join(process.cwd(), 'uploads', 'faq-images');
  if (!fs.existsSync(faqImagesDir)) {
    fs.mkdirSync(faqImagesDir, { recursive: true });
    console.log(`📁 Created FAQ images directory: ${faqImagesDir}`);
  }

  // 靜態文件服務（提供上傳的文件）
  // 注意：靜態文件服務需要在設置全局前綴之前，或者使用不同的路徑
  // 這裡設置為不帶前綴，直接訪問 /uploads/...
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global prefix（只影響 API 路由，不影響靜態文件）
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://qaplus.example.com',
    ],
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Throttler exception filter（自定義 Rate Limit 錯誤訊息）
  app.useGlobalFilters(new ThrottlerExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('QAPlus API')
    .setDescription('QAPlus Knowledge Base Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 8000;
  await app.listen(port);
  
  console.log(`🚀 Backend API is running on: http://localhost:${port}/api`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();


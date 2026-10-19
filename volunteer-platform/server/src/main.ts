import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './api.js';
import { config } from './config.js';

async function main() {
  const cfg = config();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: cfg.origin, methods: ['GET', 'POST'] });
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('青禾志愿 API').setDescription('活动、报名、审核通知、出勤时长与统计').setVersion('0.1.0').addBearerAuth().build());
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(cfg.port, '127.0.0.1');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { configureApplication } from '@app/common';
import { AppModule } from './app.module.js';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  configureApplication(app, 'Main API');
  await app.listen(app.get(ConfigService).getOrThrow<number>('app.mainPort'));
}
void bootstrap();

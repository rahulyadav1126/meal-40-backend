import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { Logger } from 'nestjs-pino';
import { configureApplication } from '@app/common';
import { AppModule } from './app.module.js';

/** Custom IoAdapter that reads CORS_ORIGINS from config and passes them to socket.io */
class CorsIoAdapter extends IoAdapter {
  private readonly allowedOrigins: string[];

  constructor(
    app: NestExpressApplication,
    config: ConfigService,
  ) {
    super(app);
    this.allowedOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOption =
      this.allowedOrigins.length
        ? { origin: this.allowedOrigins, credentials: true }
        : false;
    return super.createIOServer(port, { ...options, cors: corsOption });
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  configureApplication(app, 'Main API');

  // Apply the custom adapter so socket.io uses the same CORS origins as the HTTP layer
  app.useWebSocketAdapter(new CorsIoAdapter(app, app.get(ConfigService)));

  await app.listen(app.get(ConfigService).getOrThrow<number>('app.mainPort'));
}
void bootstrap();

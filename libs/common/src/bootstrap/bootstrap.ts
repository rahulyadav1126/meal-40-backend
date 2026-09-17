import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  API_PREFIX,
  API_VERSION,
  APP_NAME,
  SWAGGER_PATH,
} from '@app/contracts';
import { GlobalExceptionFilter } from '../filters/http-exception.filter.js';
import { ResponseInterceptor } from '../interceptors/response.interceptor.js';

export function configureApplication(
  app: NestExpressApplication,
  apiName: string,
): void {
  const config = app.get(ConfigService);
  const origins = config.get<string[]>('app.corsOrigins') ?? [];
  app.use(helmet());
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`${APP_NAME} ${apiName}`)
      .setDescription(`${APP_NAME} ${apiName} REST API`)
      .setVersion(API_VERSION)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document);
  app.enableShutdownHooks();
}

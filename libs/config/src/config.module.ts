import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './configuration.js';
import { environmentSchema } from './env.validation.js';

@Global()
@Module({})
export class Plate40ConfigModule {
  static forRoot(envFilePath: string | string[]): DynamicModule {
    return {
      module: Plate40ConfigModule,
      global: true,
      imports: [
        ConfigModule.forRoot({
          envFilePath,
          isGlobal: true,
          cache: true,
          expandVariables: true,
          load: [configuration],
          validationSchema: environmentSchema,
        }),
      ],
      exports: [ConfigModule],
    };
  }
}

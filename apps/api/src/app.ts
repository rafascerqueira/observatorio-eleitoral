import 'reflect-metadata';
import { DynamicModule, Module, type INestApplication, type NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CONFIG, type AppConfig } from './config';
import { DatabaseService } from './database/database.service';
import { HealthController } from './health/health.controller';
import { ElectionsController } from './elections/elections.controller';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      providers: [{ provide: CONFIG, useValue: config }, DatabaseService],
      controllers: [HealthController, ElectionsController],
    };
  }
}

/**
 * API só de leitura (GET): sem processamento de corpo. Com os parsers padrão, o corpo era lido em qualquer rota, inclusive sem
 * correspondência, e restringir os métodos no CORS não os desabilita (revisão de 31/10/2026).
 */
export const APP_OPTIONS = { bodyParser: false } as const satisfies NestApplicationOptions;

export function configureApp(app: INestApplication, config: AppConfig) {
  app.enableCors({ origin: config.WEB_ORIGIN, methods: ['GET'] });
  app.enableShutdownHooks();
  return app;
}

export async function createApp(config: AppConfig) {
  return configureApp(await NestFactory.create(AppModule.register(config), APP_OPTIONS), config);
}

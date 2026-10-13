import 'reflect-metadata';
import { DynamicModule, Module } from '@nestjs/common';
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

export async function createApp(config: AppConfig) {
  const app = await NestFactory.create(AppModule.register(config));
  app.enableCors({ origin: config.WEB_ORIGIN, methods: ['GET'] });
  app.enableShutdownHooks();
  return app;
}

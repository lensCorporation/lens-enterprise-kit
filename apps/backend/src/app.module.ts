import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule, CacheInterceptor } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { WinstonModule } from 'nest-winston';
import winstonInstance from './configs/winston.config';

// Custom Modules
import { AuthModule } from './auth/auth.module';
import { TrpcModule } from './trpc/trpc.module';
import { CronModule } from './cron/cron.module';
import { UtilsModule } from './utils/utils.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { HealthModule } from './health/health.module';

// Controllers & Services
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Guards & Interceptors
import { throttleConfig } from './configs/throttle.config';
import { validate } from './configs/env.config';

// Consumers
import { MailConsumer } from './consumers/mail.consumer';

// WebSockets
import { WebsocketsGateway } from './websocket/websocket.gateway';

@Module({
  imports: [
    // Load Environment Variables and Validate
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    // Logging with Winston
    WinstonModule.forRoot(winstonInstance),

    // Authentication Module (Configuration moved to `auth.config.ts`)
    AuthModule.forRoot({
      connectionURI: "http://localhost:3567",
      // apiKey: "<YOUR_API_KEY>", // If you're using an API key
      appInfo: {
        appName: "lensAuth",
        apiDomain: "http://localhost:80",  // Ensure this matches your backend API
        websiteDomain: "http://localhost:3000",  // Set this to your frontend URL
        apiBasePath: "/auth",
        websiteBasePath: "/auth",
      },
    }),

    // Rate Limiting (Throttling)
    ThrottlerModule.forRoot(throttleConfig),

    // Caching (Global)
    CacheModule.register({ isGlobal: true }),

    // Background Jobs (BullMQ & Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // Queue Registration
    BullModule.registerQueue({ name: 'mail-queue' }),

    // Bull Dashboard (Queue Monitoring)
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter, // Can be replaced with FastifyAdapter if using Fastify
    }),
    BullBoardModule.forFeature({
      name: 'mail-queue',
      adapter: BullMQAdapter, // Use BullAdapter if using Bull instead of BullMQ
    }),

    // Scheduling (Cron Jobs)
    ScheduleModule.forRoot(),

    // Feature Modules
    TrpcModule,
    CronModule,
    UtilsModule,
    FileStorageModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MailConsumer,
    
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global Caching Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },

    // WebSocket Gateway
    WebsocketsGateway,
  ],
})
export class AppModule {}

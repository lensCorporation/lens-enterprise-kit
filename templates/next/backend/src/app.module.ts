// ...
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { throttleConfig } from './configs/throttle.config';
import { WinstonModule } from 'nest-winston';
import winstonInstance from './configs/winston.config';
import { TrpcModule } from './trpc/trpc.module';
import { AppRouterHost } from 'nestjs-trpc';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { MailConsumer } from './consumers/mail.consumer';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { WebsocketsGateway } from './websocket/websocket.gateway';
import { CronModule } from './cron/cron.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { UtilsModule } from './utils/utils.module';
import { validate } from './configs/env.config';
import { ConfigModule } from '@nestjs/config';
import { FileStorageModule } from './file-storage/file-storage.module';
import { HealthModule } from './health/health.module';
import Dashboard from "supertokens-node/recipe/dashboard";
@Module({
  imports: [
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
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      }
    }),
    BullModule.registerQueue({ name: 'mail-queue' }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter // Or FastifyAdapter from `@bull-board/fastify`
    }),
    BullBoardModule.forFeature({
      name: 'mail-queue',
      adapter: BullMQAdapter, //or use BullAdapter if you're using bull instead of bullMQ
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttleConfig),
    CacheModule.register({
      isGlobal:true
    }),
    ConfigModule.forRoot({
      isGlobal:true,
      validate
    }),
    AppModule,
    TrpcModule,
    CronModule,
    UtilsModule,
    FileStorageModule,
    HealthModule
  ],
  controllers: [AppController],
  providers: [AppService, MailConsumer, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard, // Apply globally
  }, {
    provide: APP_INTERCEPTOR,
    useClass: CacheInterceptor,
  }, WebsocketsGateway],
})
export class AppModule { 
  constructor(){
  }
}
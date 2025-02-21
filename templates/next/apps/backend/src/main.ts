import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import supertokens from 'supertokens-node';
import { SupertokensExceptionFilter } from './auth/auth.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import winstonInstance from './configs/winston.config';
config();
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ZodValidationPipe } from './configs/zod-validation.pipeline';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: WinstonModule.createLogger(winstonInstance) });
  app.enableCors({
    origin: '*',  // Allow all origins
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // app.enableCors({
  //   origin: '*',  // Allow all origins
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  //   allowedHeaders: 'Content-Type, Authorization',
  //   credentials: true,
  // });

  // Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CDMS')
    .setDescription('Central Device Management System')
    .setVersion('3.0')
    //.addTag('CDMS')
    .setContact('API Support', 'www.lenscorp.ai', 'support@lenscorp.ai')
    .setExternalDoc('Find More Info about this API here', 'https://www.lenscorp.ai')
    // .setBasePath('/api/v1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.servers = [
    {
      url: 'http://localhost:{port}/api/v1',
      description: 'Server',
      variables: {
        port: {
          default: '3000',
          enum: ['8080', '3000', '5000'],
          description: 'Port for the server',
        },
      },
    },
  ];

  SwaggerModule.setup('api-docs', app, document);

  // app.setGlobalPrefix('/api/v1');

  app.useGlobalFilters(new SupertokensExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe());
  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT') || 80);
}

bootstrap();
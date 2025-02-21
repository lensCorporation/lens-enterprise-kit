import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import supertokens from 'supertokens-node';
import { SupertokensExceptionFilter } from './auth/auth.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import winstonInstance from './configs/winston.config';
import { ConfigService } from '@nestjs/config';
// import { ValidationPipe } from '@nestjs/common';
import { ZodValidationPipe } from './configs/zod-validation.pipeline';

async function bootstrap() {
  // Create the NestJS application with Winston logger
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonInstance),
  });

  // Get configuration service
  const configService = app.get(ConfigService);

  // Enable CORS (with environment-configurable origins)
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') || '*', // Restrict in production
    allowedHeaders: ['Content-Type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CDMS API')
    .setDescription('Central Device Management System API Documentation')
    .setVersion('3.0')
    .setContact('API Support', 'https://www.lenscorp.ai', 'support@lenscorp.ai')
    .setExternalDoc('More API Info', 'https://www.lenscorp.ai')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.servers = [
    {
      url: `http://localhost:{port}/api/v1`,
      description: 'Local Development Server',
      variables: {
        port: {
          default: '3000',
          enum: ['8080', '3000', '5000'],
          description: 'Available server ports',
        },
      },
    },
  ];

  // Set up Swagger UI
  SwaggerModule.setup('api-docs', app, document);

  // Set global API prefix
  app.setGlobalPrefix('/api/v1');

  // Apply global exception filters and validation pipes
  app.useGlobalFilters(new SupertokensExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  // Start the application
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Server running at http://localhost:${port}/api/v1`);
}

bootstrap();
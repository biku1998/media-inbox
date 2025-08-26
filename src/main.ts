import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { EnvValidationService } from './common/config/env-validation.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`🔄 Received ${signal}, starting graceful shutdown...`);
    try {
      await app.close();
      console.log('✅ Application closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  // Security headers and CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global rate limiting - will be applied after app initialization
  // Note: Rate limiting is configured in the CacheModule which is imported globally

  // Validate environment variables
  try {
    const envValidationService = app.get(EnvValidationService);
    envValidationService.validateEnvironment();
  } catch {
    console.warn(
      'Environment validation disabled: EnvValidationService not available',
    );
  }

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Media Inbox API')
    .setDescription(
      'A production-ready Media Inbox backend system with async file processing pipeline. ' +
        'Supports file uploads via presigned URLs, background processing, and asset management.',
    )
    .setVersion('1.0.0')
    .addTag('auth', 'Authentication and user management endpoints')
    .addTag('uploads', 'File upload and asset management endpoints')
    .addTag('health', 'Health check and monitoring endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for @ApiBearerAuth() decorator
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
    },
    customSiteTitle: 'Media Inbox API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2.5em; color: #3b82f6; }
      .swagger-ui .info .description { font-size: 1.1em; color: #6b7280; }
    `,
  });

  // Start the application first
  await app.listen(process.env.PORT ?? 3000);

  // Now we can get the URL after listening
  console.log('🚀 Media Inbox API is running on:', await app.getUrl());
  console.log(
    '📚 Swagger documentation available at:',
    (await app.getUrl()) + '/docs',
  );
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});

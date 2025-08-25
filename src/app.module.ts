import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { AppConfigModule } from 'src/common/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CacheModule } from 'src/common/cache/cache.module';
import { HealthController } from 'src/common/health/health.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { AssetsModule } from 'src/assets/assets.module';
import { RateLimitInterceptor } from 'src/common/interceptors/rate-limit.interceptor';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { SecurityMiddleware } from 'src/common/middleware/security.middleware';
import { GracefulShutdownService } from 'src/common/services/graceful-shutdown.service';
import { EnvValidationService } from 'src/common/config/env-validation.service';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CacheModule,
    AuthModule,
    UploadsModule,
    JobsModule,
    AssetsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    GracefulShutdownService,
    EnvValidationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}

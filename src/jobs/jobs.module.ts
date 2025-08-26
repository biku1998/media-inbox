import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { AuditModule } from 'src/common/audit.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MediaProcessingProcessor } from './processors/media-processing.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => UploadsModule),
    AuditModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'media-processing',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService, MediaProcessingProcessor],
  exports: [JobsService],
})
export class JobsModule {}

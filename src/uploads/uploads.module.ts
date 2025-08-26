import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { S3Service } from './s3.service';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { ThumbnailService } from './thumbnail.service';

@Module({
  imports: [ConfigModule, PrismaModule, forwardRef(() => JobsModule)],
  controllers: [UploadsController],
  providers: [S3Service, UploadsService, ThumbnailService],
  exports: [S3Service, UploadsService, ThumbnailService],
})
export class UploadsModule {}

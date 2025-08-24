import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { S3Service } from './s3.service';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [ConfigModule, PrismaModule, JobsModule],
  controllers: [UploadsController],
  providers: [S3Service, UploadsService],
  exports: [S3Service, UploadsService],
})
export class UploadsModule {}

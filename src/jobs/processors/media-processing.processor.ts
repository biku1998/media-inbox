import {
  Process,
  Processor,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';

import { JobsService, MediaProcessingJobData } from '../jobs.service';

@Processor('media-processing')
export class MediaProcessingProcessor {
  private readonly logger = new Logger(MediaProcessingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onError(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @Process('process-media')
  async processMedia(job: Job<MediaProcessingJobData>) {
    const { assetId, objectKey, mimeType, originalFilename } = job.data;

    this.logger.log(`Starting media processing for asset: ${assetId}`);

    try {
      // Update asset status to PROCESSING
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { status: 'PROCESSING' },
      });

      // Process based on file type
      if (mimeType.startsWith('image/')) {
        await this.processImage(assetId, objectKey, originalFilename);
      } else if (mimeType.includes('pdf')) {
        await this.processDocument(assetId, objectKey, originalFilename);
      } else {
        await this.processGenericFile(assetId, objectKey, originalFilename);
      }

      // Update asset status to READY
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { status: 'READY' },
      });

      this.logger.log(`Media processing completed for asset: ${assetId}`);

      return { success: true, assetId, status: 'READY' };
    } catch (error) {
      this.logger.error(`Media processing failed for asset ${assetId}:`, error);

      // Update asset status to FAILED
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  private async processImage(
    assetId: string,
    objectKey: string,
    originalFilename: string,
  ): Promise<void> {
    this.logger.log(`Processing image: ${originalFilename}`);

    // Generate thumbnail
    const thumbnailKey = this.generateThumbnail(objectKey);

    // Update asset with thumbnail key
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        thumbKey: thumbnailKey,
        meta: {
          processed: true,
          thumbnailGenerated: true,
          originalFilename,
          processedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async processDocument(
    assetId: string,
    objectKey: string,
    originalFilename: string,
  ): Promise<void> {
    this.logger.log(`Processing document: ${originalFilename}`);

    // For documents, we might extract text, generate preview, etc.
    // For now, just mark as processed
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        meta: {
          processed: true,
          documentType: 'document',
          originalFilename,
          processedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async processGenericFile(
    assetId: string,
    objectKey: string,
    originalFilename: string,
  ): Promise<void> {
    this.logger.log(`Processing generic file: ${originalFilename}`);

    // For generic files, just mark as processed
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        meta: {
          processed: true,
          fileType: 'generic',
          originalFilename,
          processedAt: new Date().toISOString(),
        },
      },
    });
  }

  private generateThumbnail(objectKey: string): string {
    try {
      // Generate thumbnail key
      const thumbnailKey = objectKey.replace(/\.[^/.]+$/, '_thumb.jpg');

      // For now, we'll create a placeholder thumbnail
      // In a real implementation, you'd download the image from S3, resize it, and upload the thumbnail
      this.logger.log(`Would generate thumbnail: ${thumbnailKey}`);

      // TODO: Implement actual thumbnail generation
      // 1. Download image from S3
      // 2. Resize using Sharp
      // 3. Upload thumbnail to S3

      return thumbnailKey;
    } catch (error) {
      this.logger.error('Failed to generate thumbnail:', error);
      throw error;
    }
  }
}

import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { Job } from 'bull';
import * as sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';
import { ThumbnailService } from 'src/uploads/thumbnail.service';
import { AuditService } from 'src/common/services/audit.service';

import { JobsService, MediaProcessingJobData } from '../jobs.service';

@Processor('media-processing')
export class MediaProcessingProcessor implements OnApplicationShutdown {
  private readonly logger = new Logger(MediaProcessingProcessor.name);
  private isShuttingDown = false;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private thumbnailService: ThumbnailService,
    private jobsService: JobsService,
    private auditService: AuditService,
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
    const { assetId, objectKey, originalFilename } = job.data;

    // Check if we're shutting down
    if (this.isShuttingDown) {
      this.logger.warn(`Skipping job ${job.id} - application is shutting down`);
      throw new Error('Application is shutting down');
    }

    this.logger.log(`Starting media processing for asset: ${assetId}`);

    // Get asset owner ID for audit logging
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { ownerId: true },
    });

    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Log job started event
    await this.auditService.logJobEvent(asset.ownerId, 'JOB_STARTED', assetId, {
      jobId: String(job.id),
      objectKey,
      originalFilename,
    });

    // Create database job record
    let dbJob: { id: string } | null = null;
    try {
      dbJob = await this.prisma.job.create({
        data: {
          assetId,
          state: 'ACTIVE',
          attempts: 0,
        },
      });
      this.logger.log(`Created database job record: ${dbJob.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to create database job record: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Continue processing even if database job creation fails
    }

    try {
      // Update asset status to PROCESSING
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { status: 'PROCESSING' },
      });

      // Download the image from S3
      this.logger.debug(`Downloading image ${objectKey} from S3`);
      const imageBuffer =
        await this.s3Service.downloadObjectAsBuffer(objectKey);
      this.logger.debug(`Downloaded image: ${imageBuffer.length} bytes`);

      // Extract comprehensive metadata from the image
      const metadata = await this.extractImageMetadata(imageBuffer);
      this.logger.debug(`Extracted metadata: ${JSON.stringify(metadata)}`);

      // Generate thumbnail
      this.logger.debug(`Generating thumbnail for ${originalFilename}`);
      const thumbnailResult = await this.thumbnailService.generateThumbnail(
        imageBuffer,
        {
          width: 300,
          height: 300,
          quality: 80,
          format: 'jpeg',
        },
      );

      // Generate thumbnail key
      const thumbnailKey = this.generateThumbnailKey(
        objectKey,
        metadata.format,
      );
      this.logger.debug(`Generated thumbnail key: ${thumbnailKey}`);

      // Upload thumbnail to S3
      this.logger.debug(`Uploading thumbnail to S3: ${thumbnailKey}`);
      await this.s3Service.uploadObject(
        thumbnailKey,
        thumbnailResult.buffer,
        metadata.mimeType,
      );

      // Update asset with comprehensive metadata and mark as READY
      const processingMeta = {
        format: metadata.format,
        mimeType: metadata.mimeType,
        processed: true,
        processedAt: new Date().toISOString(),
        originalSize: imageBuffer.length,
        thumbnailSize: thumbnailResult.buffer.length,
        compressionRatio: `${(
          ((imageBuffer.length - thumbnailResult.buffer.length) /
            imageBuffer.length) *
          100
        ).toFixed(1)}%`,
        originalFilename,
        originalDimensions: `${metadata.width}x${metadata.height}`,
        thumbnailDimensions: `${thumbnailResult.width}x${thumbnailResult.height}`,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
          hasProfile: metadata.hasProfile,
          space: metadata.space,
          depth: metadata.depth,
          density: metadata.density,
          orientation: metadata.orientation,
        },
        thumbnailGenerated: true,
      };

      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'READY',
          thumbKey: thumbnailKey,
          meta: processingMeta,
        },
      });

      // Update database job as completed
      if (dbJob) {
        await this.prisma.job.update({
          where: { id: dbJob.id },
          data: {
            state: 'COMPLETED',
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Updated database job ${dbJob.id} as completed`);
      }

      // Log job completed event
      await this.auditService.logJobEvent(
        asset.ownerId,
        'JOB_COMPLETED',
        assetId,
        {
          jobId: String(job.id),
          objectKey,
          originalFilename,
          thumbnailKey,
          processingMeta,
        },
      );

      this.logger.log(
        `Image processing completed successfully for ${originalFilename}`,
      );
      this.logger.log(`Media processing completed for asset: ${assetId}`);

      return {
        success: true,
        assetId,
        thumbnailKey,
        processingMeta,
      };
    } catch (error) {
      this.logger.error(
        `Error processing media for asset ${assetId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Log job failed event
      await this.auditService.logJobEvent(
        asset.ownerId,
        'JOB_FAILED',
        assetId,
        {
          jobId: String(job.id),
          objectKey,
          originalFilename,
          error: error instanceof Error ? error.message : String(error),
          attempts: job.attemptsMade,
        },
      );

      // Update asset status to FAILED
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { status: 'FAILED' },
      });

      // Update database job as failed
      if (dbJob) {
        await this.prisma.job.update({
          where: { id: dbJob.id },
          data: {
            state: 'FAILED',
            lastError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Updated database job ${dbJob.id} as failed`);
      }

      throw error;
    }
  }

  /**
   * Extract comprehensive metadata from image buffer
   */
  private async extractImageMetadata(buffer: Buffer) {
    const metadata = await sharp(buffer).metadata();
    return {
      format: metadata.format || 'jpeg',
      mimeType: `image/${metadata.format || 'jpeg'}`,
      width: metadata.width || 0,
      height: metadata.height || 0,
      channels: metadata.channels || 0,
      hasAlpha: metadata.hasAlpha || false,
      hasProfile: metadata.hasProfile || false,
      space: metadata.space || 'srgb',
      depth: metadata.depth || 8,
      density: metadata.density || 96,
      orientation: metadata.orientation || 1,
    };
  }

  /**
   * Generate thumbnail key from original key
   */
  private generateThumbnailKey(originalKey: string, format: string): string {
    // Remove file extension and add thumbnail suffix
    const baseKey = originalKey.replace(/\.[^/.]+$/, '');
    return `${baseKey}_thumb.${format}`;
  }

  /**
   * Handle graceful shutdown
   */
  async onApplicationShutdown(signal?: string) {
    this.logger.log(`🔄 Shutdown signal received: ${signal}`);
    this.isShuttingDown = true;

    // Wait for current job to complete
    this.logger.log('Waiting for current job to complete...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    this.logger.log('✅ Job processor shutdown completed');
  }
}

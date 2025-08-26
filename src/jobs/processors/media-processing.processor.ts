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
import { S3Service } from 'src/uploads/s3.service';
import { ThumbnailService } from 'src/uploads/thumbnail.service';

import { JobsService, MediaProcessingJobData } from '../jobs.service';

@Processor('media-processing')
export class MediaProcessingProcessor {
  private readonly logger = new Logger(MediaProcessingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
    private s3Service: S3Service,
    private thumbnailService: ThumbnailService,
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
        await this.processImage(assetId, objectKey, originalFilename, mimeType);
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
        data: {
          status: 'FAILED',
          meta: {
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          },
        },
      });

      throw error;
    }
  }

  private async processImage(
    assetId: string,
    objectKey: string,
    originalFilename: string,
    mimeType: string,
  ): Promise<void> {
    this.logger.log(`Processing image: ${originalFilename} (${mimeType})`);

    try {
      // Download the image from S3
      this.logger.debug(`Downloading image ${objectKey} from S3`);
      const imageBuffer =
        await this.s3Service.downloadObjectAsBuffer(objectKey);
      this.logger.debug(`Downloaded image: ${imageBuffer.length} bytes`);

      // Extract image format from MIME type
      const imageFormat = this.extractImageFormat(mimeType);
      this.logger.debug(`Detected image format: ${imageFormat}`);

      // Generate thumbnail
      this.logger.debug(`Generating thumbnail for ${originalFilename}`);
      const thumbnailResult = await this.thumbnailService.processImageFormat(
        imageBuffer,
        imageFormat,
        {
          maxWidth: 300,
          maxHeight: 300,
          quality: 80,
          format: 'jpeg',
        },
      );

      // Generate thumbnail key
      const thumbnailKey = this.generateThumbnailKey(
        objectKey,
        thumbnailResult.format,
      );
      this.logger.debug(`Generated thumbnail key: ${thumbnailKey}`);

      // Upload thumbnail to S3
      this.logger.debug(`Uploading thumbnail to S3: ${thumbnailKey}`);
      await this.s3Service.uploadObject(
        thumbnailKey,
        thumbnailResult.buffer,
        `image/${thumbnailResult.format}`,
      );

      // Update asset with thumbnail key and metadata
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          thumbKey: thumbnailKey,
          meta: {
            processed: true,
            thumbnailGenerated: true,
            originalFilename,
            originalSize: imageBuffer.length,
            thumbnailSize: thumbnailResult.size,
            originalDimensions: `${thumbnailResult.metadata.width}x${thumbnailResult.metadata.height}`,
            thumbnailDimensions: `${thumbnailResult.width}x${thumbnailResult.height}`,
            compressionRatio:
              (
                ((imageBuffer.length - thumbnailResult.size) /
                  imageBuffer.length) *
                100
              ).toFixed(1) + '%',
            format: imageFormat,
            processedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(
        `Image processing completed successfully for ${originalFilename}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process image ${originalFilename}:`, error);
      throw new Error(
        `Image processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  /**
   * Extract image format from MIME type
   * @param mimeType - The MIME type string
   * @returns string - The image format
   */
  private extractImageFormat(mimeType: string): string {
    const formatMap: Record<string, string> = {
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/tiff': 'tiff',
      'image/bmp': 'bmp',
    };

    return formatMap[mimeType.toLowerCase()] || 'jpeg';
  }

  /**
   * Generate thumbnail key for S3 storage
   * @param originalKey - The original object key
   * @param format - The thumbnail format
   * @returns string - The thumbnail object key
   */
  private generateThumbnailKey(originalKey: string, format: string): string {
    // Remove file extension and add thumbnail suffix
    const baseKey = originalKey.replace(/\.[^/.]+$/, '');
    return `${baseKey}_thumb.${format}`;
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Service } from './s3.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobsService, MediaProcessingJobData } from 'src/jobs/jobs.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { UploadCompleteResponseDto } from './dto/upload-complete-response.dto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async generatePresignedUploadUrl(
    presignDto: PresignUploadDto,
  ): Promise<PresignResponseDto> {
    // Validate file type
    this.validateFileType(presignDto.contentType);

    // Generate secure object key
    const objectKey = this.generateObjectKey(presignDto.filename);

    // Generate presigned URL
    const uploadUrl = await this.s3Service.generatePresignedPutUrl(
      objectKey,
      presignDto.contentType,
      3600, // 1 hour expiration
    );

    // Prepare required headers
    const headers = {
      'Content-Type': presignDto.contentType,
      'x-amz-meta-original-filename': presignDto.filename,
      'x-amz-meta-file-size': presignDto.fileSize.toString(),
      ...(presignDto.sha256Hash && {
        'x-amz-meta-sha256-hash': presignDto.sha256Hash,
      }),
    };

    this.logger.log(
      `Generated presigned URL for ${presignDto.filename} -> ${objectKey}`,
    );

    return {
      uploadUrl,
      objectKey,
      expiresIn: 3600,
      headers,
    };
  }

  private validateFileType(contentType: string): void {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        `File type ${contentType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }
  }

  private generateObjectKey(filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Generate unique identifier
    const uuid = uuidv4();

    // Get file extension
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);

    // Create sanitized filename (remove special characters)
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '_');

    // Format: uploads/YYYY/MM/DD/uuid-sanitized-name.ext
    return `uploads/${year}/${month}/${day}/${uuid}-${sanitizedName}${ext}`;
  }

  async testS3Connection(): Promise<boolean> {
    return this.s3Service.testConnection();
  }

  async completeUpload(
    uploadCompleteDto: UploadCompleteDto,
    userId: string,
  ): Promise<UploadCompleteResponseDto> {
    // Validate file type
    this.validateFileType(uploadCompleteDto.contentType);

    // Validate file size
    if (
      uploadCompleteDto.fileSize <= 0 ||
      uploadCompleteDto.fileSize > 104857600
    ) {
      throw new BadRequestException('Invalid file size');
    }

    // Create asset record in database
    const asset = await this.prisma.asset.create({
      data: {
        objectKey: uploadCompleteDto.objectKey,
        mime: uploadCompleteDto.contentType,
        size: uploadCompleteDto.fileSize,
        status: 'PENDING',
        ownerId: userId,
        meta: {
          originalFilename: uploadCompleteDto.filename,
          sha256Hash: uploadCompleteDto.sha256Hash,
        },
      },
    });

    this.logger.log(
      `Asset created for ${uploadCompleteDto.filename} with ID: ${asset.id}`,
    );

    // Enqueue media processing job
    const jobData: MediaProcessingJobData = {
      assetId: asset.id,
      objectKey: asset.objectKey,
      mimeType: asset.mime,
      fileSize: asset.size,
      originalFilename: uploadCompleteDto.filename,
    };

    await this.jobsService.addMediaProcessingJob(jobData);
    this.logger.log(`Media processing job enqueued for asset: ${asset.id}`);

    return {
      assetId: asset.id,
      objectKey: asset.objectKey,
      status: asset.status,
      message: 'File uploaded successfully and queued for processing',
      completedAt: asset.createdAt.toISOString(),
    };
  }
}

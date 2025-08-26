import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>('S3_BUCKET') || 'media-inbox';

    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY');
    const secretKey = this.configService.get<string>('S3_SECRET_KEY');
    const region = this.configService.get<string>('S3_REGION', 'ap-south-1');

    // For AWS S3, endpoint is optional (uses default AWS endpoints)
    if (!accessKey || !secretKey) {
      throw new Error(
        'Missing required S3 configuration: S3_ACCESS_KEY, S3_SECRET_KEY',
      );
    }

    const clientConfig: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
    } = {
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    };

    // Only add endpoint if explicitly provided (for local testing or other S3-compatible services)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }

    this.s3Client = new S3Client(clientConfig);
  }

  async ensureBucketExists(): Promise<void> {
    try {
      // Check if bucket exists
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log(`Bucket ${this.bucketName} already exists`);
    } catch {
      // Bucket doesn't exist, create it
      try {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        this.logger.log(`Bucket ${this.bucketName} created successfully`);
      } catch (createError) {
        this.logger.error(
          `Failed to create bucket ${this.bucketName}:`,
          createError,
        );
        throw createError;
      }
    }
  }

  async generatePresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async generatePresignedGetUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureBucketExists();
      return true;
    } catch (error) {
      this.logger.error('S3 connection test failed:', error);
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`Object ${key} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${key}:`, error);
      throw error;
    }
  }

  // New methods for thumbnail generation

  /**
   * Download an object from S3 as a Buffer
   * @param key - S3 object key
   * @returns Promise<Buffer> - The file content as a buffer
   */
  async downloadObjectAsBuffer(key: string): Promise<Buffer> {
    try {
      this.logger.debug(`Downloading object ${key} as buffer`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body returned for object ${key}`);
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const stream = response.Body as Readable;

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to download object ${key} as buffer:`, error);
      throw error;
    }
  }

  /**
   * Upload a buffer to S3 as an object
   * @param key - S3 object key
   * @param buffer - File content as buffer
   * @param contentType - MIME type of the file
   * @returns Promise<void>
   */
  async uploadObject(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Uploading object ${key} (${buffer.length} bytes)`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      });

      await this.s3Client.send(command);
      this.logger.log(`Object ${key} uploaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to upload object ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get an object from S3 as a readable stream
   * @param key - S3 object key
   * @returns Promise<Readable> - The file content as a readable stream
   */
  async getObjectStream(key: string): Promise<Readable> {
    try {
      this.logger.debug(`Getting object ${key} as stream`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body returned for object ${key}`);
      }

      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get object ${key} as stream:`, error);
      throw error;
    }
  }
}

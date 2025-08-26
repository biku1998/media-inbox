import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  background?: string;
}

export interface ThumbnailResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  metadata: sharp.Metadata;
}

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: string;
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly defaultOptions: Required<ThumbnailOptions>;

  constructor(private configService: ConfigService) {
    this.defaultOptions = {
      width: this.configService.get<number>('THUMBNAIL_WIDTH', 300),
      height: this.configService.get<number>('THUMBNAIL_HEIGHT', 300),
      quality: this.configService.get<number>('THUMBNAIL_QUALITY', 80),
      format: this.configService.get<'jpeg' | 'png' | 'webp'>(
        'THUMBNAIL_FORMAT',
        'jpeg',
      ),
      fit: this.configService.get<
        'cover' | 'contain' | 'fill' | 'inside' | 'outside'
      >('THUMBNAIL_FIT', 'cover'),
      background: this.configService.get<string>(
        'THUMBNAIL_BACKGROUND',
        '#FFFFFF',
      ),
    };
  }

  /**
   * Generate a thumbnail from an image buffer
   * @param imageBuffer - The source image as a buffer
   * @param options - Thumbnail generation options
   * @returns Promise<ThumbnailResult> - The generated thumbnail
   */
  async generateThumbnail(
    imageBuffer: Buffer,
    options: Partial<ThumbnailOptions> = {},
  ): Promise<ThumbnailResult> {
    try {
      const finalOptions = { ...this.defaultOptions, ...options };
      this.logger.debug(`Generating thumbnail with options:`, finalOptions);

      // Get image metadata first
      const metadata = await sharp(imageBuffer).metadata();
      this.logger.debug(`Source image metadata:`, {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
      });

      // Create sharp instance with the image
      let sharpInstance = sharp(imageBuffer);

      // Resize the image
      sharpInstance = sharpInstance.resize({
        width: finalOptions.width,
        height: finalOptions.height,
        fit: finalOptions.fit,
        background: finalOptions.background,
        withoutEnlargement: true, // Don't enlarge if image is smaller
      });

      // Apply format-specific processing
      const format = finalOptions.format;
      switch (format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({
            quality: finalOptions.quality,
            progressive: true,
            mozjpeg: true, // Better compression
          });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({
            compressionLevel: 9, // Maximum compression
            progressive: true,
          });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({
            quality: finalOptions.quality,
            effort: 6, // Maximum compression effort
          });
          break;
        default:
          // This should never happen due to type constraints
          throw new Error(`Unsupported output format: ${String(format)}`);
      }

      // Generate the thumbnail
      const thumbnailBuffer = await sharpInstance.toBuffer();
      const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

      const result: ThumbnailResult = {
        buffer: thumbnailBuffer,
        format: finalOptions.format,
        width: thumbnailMetadata.width || finalOptions.width,
        height: thumbnailMetadata.height || finalOptions.height,
        size: thumbnailBuffer.length,
        metadata: thumbnailMetadata,
      };

      this.logger.log(`Thumbnail generated successfully:`, {
        originalSize: imageBuffer.length,
        thumbnailSize: result.size,
        compressionRatio: `${(
          ((imageBuffer.length - result.size) / imageBuffer.length) *
          100
        ).toFixed(1)}%`,
        dimensions: `${result.width}x${result.height}`,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate thumbnail:', error);
      throw new Error(
        `Thumbnail generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Process different image formats with appropriate handling
   * @param buffer - The source image buffer
   * @param format - The source image format
   * @param options - Processing options
   * @returns Promise<ProcessedImage> - The processed image result
   */
  async processImageFormat(
    buffer: Buffer,
    format: string,
    options: ProcessingOptions = {},
  ): Promise<ThumbnailResult> {
    try {
      this.logger.debug(`Processing image format: ${format}`);

      // Validate image format
      if (!this.isSupportedImageFormat(format)) {
        throw new Error(`Unsupported image format: ${format}`);
      }

      // Get image metadata
      const metadata = await sharp(buffer).metadata();

      // Determine optimal thumbnail dimensions
      const { width, height } = this.calculateOptimalDimensions(
        metadata.width || 0,
        metadata.height || 0,
        options.maxWidth || this.defaultOptions.width,
        options.maxHeight || this.defaultOptions.height,
      );

      // Generate thumbnail with calculated dimensions
      return this.generateThumbnail(buffer, {
        width,
        height,
        quality: options.quality || this.defaultOptions.quality,
        format:
          (options.format as 'jpeg' | 'png' | 'webp') ||
          this.defaultOptions.format,
      });
    } catch (error) {
      this.logger.error(`Failed to process image format ${format}:`, error);
      throw error;
    }
  }

  /**
   * Check if an image format is supported
   * @param format - The image format to check
   * @returns boolean - True if supported
   */
  private isSupportedImageFormat(format: string): boolean {
    const supportedFormats = [
      'jpeg',
      'jpg',
      'png',
      'gif',
      'webp',
      'tiff',
      'bmp',
    ];
    return supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Calculate optimal thumbnail dimensions while maintaining aspect ratio
   * @param originalWidth - Original image width
   * @param originalHeight - Original image height
   * @param maxWidth - Maximum allowed width
   * @param maxHeight - Maximum allowed height
   * @returns {width: number, height: number} - Optimal dimensions
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    if (originalWidth === 0 || originalHeight === 0) {
      return { width: maxWidth, height: maxHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    let width = maxWidth;
    let height = maxHeight;

    if (aspectRatio > 1) {
      // Landscape image
      height = Math.round(maxWidth / aspectRatio);
      if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(maxHeight * aspectRatio);
      }
    } else {
      // Portrait or square image
      width = Math.round(maxHeight * aspectRatio);
      if (width > maxWidth) {
        width = maxWidth;
        height = Math.round(maxWidth / aspectRatio);
      }
    }

    return { width, height };
  }

  /**
   * Get supported output formats
   * @returns string[] - Array of supported output formats
   */
  getSupportedFormats(): string[] {
    return ['jpeg', 'png', 'webp'];
  }

  /**
   * Get default thumbnail options
   * @returns ThumbnailOptions - The default options
   */
  getDefaultOptions(): Required<ThumbnailOptions> {
    return { ...this.defaultOptions };
  }

  /**
   * Validate thumbnail options
   * @param options - Options to validate
   * @returns boolean - True if valid
   */
  validateOptions(options: Partial<ThumbnailOptions>): boolean {
    if (options.width && (options.width < 1 || options.width > 4096)) {
      return false;
    }
    if (options.height && (options.height < 1 || options.height > 4096)) {
      return false;
    }
    if (options.quality && (options.quality < 1 || options.quality > 100)) {
      return false;
    }
    if (
      options.format &&
      !this.getSupportedFormats().includes(options.format)
    ) {
      return false;
    }
    return true;
  }
}

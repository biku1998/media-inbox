import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThumbnailService } from './thumbnail.service';

describe('ThumbnailService Integration', () => {
  let service: ThumbnailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThumbnailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(<T>(key: string, defaultValue?: T): T => {
              const config: Record<string, T> = {
                THUMBNAIL_WIDTH: 300 as T,
                THUMBNAIL_HEIGHT: 300 as T,
                THUMBNAIL_QUALITY: 80 as T,
                THUMBNAIL_FORMAT: 'jpeg' as T,
                THUMBNAIL_FIT: 'cover' as T,
                THUMBNAIL_BACKGROUND: '#FFFFFF' as T,
              };
              return (config[key] ?? defaultValue) as T;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ThumbnailService>(ThumbnailService);
  });

  it('should generate thumbnail with default options', async () => {
    // Create a simple test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await service.generateThumbnail(testImageBuffer);

    expect(result).toBeDefined();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.format).toBe('jpeg');
    // The actual dimensions might be different due to Sharp's processing
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.size).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
  });

  it('should process different image formats', async () => {
    // Test with a simple PNG image
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await service.processImageFormat(pngBuffer, 'png', {
      maxWidth: 150,
      maxHeight: 150,
      quality: 90,
    });

    expect(result).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.format).toBe('jpeg'); // Output format is always jpeg by default
  });

  it('should handle unsupported formats gracefully', async () => {
    const unsupportedBuffer = Buffer.from('unsupported format');

    await expect(
      service.processImageFormat(unsupportedBuffer, 'unsupported'),
    ).rejects.toThrow('Unsupported image format: unsupported');
  });
});

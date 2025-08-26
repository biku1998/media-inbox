import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThumbnailService } from './thumbnail.service';

describe('ThumbnailService', () => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have default options', () => {
    const options = service.getDefaultOptions();
    expect(options.width).toBe(300);
    expect(options.height).toBe(300);
    expect(options.quality).toBe(80);
    expect(options.format).toBe('jpeg');
    expect(options.fit).toBe('cover');
    expect(options.background).toBe('#FFFFFF');
  });

  it('should get supported formats', () => {
    const formats = service.getSupportedFormats();
    expect(formats).toContain('jpeg');
    expect(formats).toContain('png');
    expect(formats).toContain('webp');
  });

  it('should validate basic options', () => {
    // Test basic validation
    expect(service.validateOptions({})).toBe(true);
    expect(service.validateOptions({ width: 100 })).toBe(true);
    expect(service.validateOptions({ format: 'jpeg' })).toBe(true);
  });
});

import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';

export class AssetResponseDto {
  @ApiProperty({
    description: 'Unique asset identifier',
    example: 'cmeq1wmrw0001z97fu028bcd5',
    pattern: '^[a-zA-Z0-9]{25}$',
  })
  id: string;

  @ApiProperty({
    description: 'Object key in S3 storage',
    example: 'uploads/2025/08/25/a86ee7b6-6a87-41d9-b6d8-184b8b30d1bc-test.pdf',
  })
  objectKey: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  mime: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  size: number;

  @ApiProperty({
    description: 'Current status of the asset',
    enum: AssetStatus,
    enumName: 'AssetStatus',
    example: 'READY',
  })
  status: AssetStatus;

  @ApiProperty({
    description: 'Thumbnail object key (if available)',
    example:
      'uploads/2025/08/25/a86ee7b6-6a87-41d9-b6d8-184b8b30d1bc-test_thumb.jpg',
    required: false,
  })
  thumbKey?: string | null;

  @ApiProperty({
    description: 'Additional metadata',
    example: {
      originalFilename: 'document.pdf',
      sha256Hash: 'a1b2c3d4e5f6...',
      processed: true,
      thumbnailGenerated: true,
    },
    required: false,
  })
  meta?: any;

  @ApiProperty({
    description: 'Asset creation timestamp',
    example: '2025-08-24T18:58:05.517Z',
    format: 'date-time',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Asset last update timestamp',
    example: '2025-08-24T18:58:05.517Z',
    format: 'date-time',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'Signed URL for file access (expires in 1 hour)',
    example:
      'http://localhost:9000/media-inbox/uploads/2025/08/25/...?X-Amz-Algorithm=...',
  })
  downloadUrl: string;

  @ApiProperty({
    description: 'Signed URL for thumbnail access (if available)',
    example:
      'http://localhost:9000/media-inbox/uploads/2025/08/25/...?X-Amz-Algorithm=...',
    required: false,
  })
  thumbnailUrl?: string;
}

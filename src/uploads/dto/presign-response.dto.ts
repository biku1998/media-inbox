import { ApiProperty } from '@nestjs/swagger';

export class PresignResponseDto {
  @ApiProperty({
    description: 'Presigned PUT URL for uploading the file',
    example:
      'http://localhost:9000/media-inbox/uploads/2025/08/25/uuid-filename.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...',
    minLength: 1,
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Object key to use when uploading',
    example: 'uploads/2024/01/15/uuid-filename.pdf',
  })
  objectKey: string;

  @ApiProperty({
    description: 'Expiration time of the presigned URL in seconds',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Required headers for the upload request',
    example: {
      'Content-Type': 'application/pdf',
      'x-amz-meta-original-filename': 'document.pdf',
    },
  })
  headers: Record<string, string>;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';

export class UploadCompleteDto {
  @ApiProperty({
    description: 'Object key returned from presign endpoint',
    example: 'uploads/2025/08/25/a86ee7b6-6a87-41d9-b6d8-184b8b30d1bc-test.pdf',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  objectKey: string;

  @ApiProperty({
    description: 'Original filename of the uploaded file',
    example: 'document.pdf',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'MIME type of the uploaded file',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-.+]+$/, {
    message: 'Invalid MIME type format',
  })
  contentType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
    minimum: 1,
    maximum: 104857600,
  })
  @IsNumber()
  @Min(1)
  @Max(104857600) // 100MB max
  fileSize: number;

  @ApiProperty({
    description: 'Optional SHA-256 hash of the uploaded file for validation',
    example: 'a1b2c3d4e5f6...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'SHA-256 hash must be 64 hexadecimal characters',
  })
  sha256Hash?: string;
}

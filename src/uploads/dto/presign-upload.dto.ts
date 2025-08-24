import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class PresignUploadDto {
  @ApiProperty({
    description: 'Original filename of the file to upload',
    example: 'vacation-photo.jpg',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'MIME type of the file',
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
    description: 'Optional SHA-256 hash of the file for validation',
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

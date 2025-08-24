import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class ListAssetsDto {
  @ApiProperty({
    description: 'Cursor for pagination (asset ID)',
    example: 'cmeq1wmrw0001z97fu028bcd5',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: 'Number of assets to return (max 50)',
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by asset status',
    enum: AssetStatus,
    enumName: 'AssetStatus',
    example: 'READY',
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiProperty({
    description: 'Search by filename (partial match)',
    example: 'document',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by MIME type',
    example: 'image/jpeg',
    required: false,
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

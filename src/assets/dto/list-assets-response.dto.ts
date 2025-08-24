import { ApiProperty } from '@nestjs/swagger';
import { AssetResponseDto } from './asset-response.dto';

export class ListAssetsResponseDto {
  @ApiProperty({
    description: 'List of assets',
    type: [AssetResponseDto],
  })
  assets: AssetResponseDto[];

  @ApiProperty({
    description: 'Total number of assets matching the filters',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Number of assets returned in this page',
    example: 20,
  })
  count: number;

  @ApiProperty({
    description: 'Cursor for the next page (null if no more pages)',
    example: 'cmeq1wmrw0001z97fu028bcd5',
    required: false,
  })
  nextCursor?: string;

  @ApiProperty({
    description: 'Cursor for the previous page (null if first page)',
    example: 'cmeq1wmrw0000z97fu028bcd4',
    required: false,
  })
  prevCursor?: string;

  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 3,
  })
  page: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there are more pages',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there are previous pages',
    example: true,
  })
  hasPrev: boolean;
}

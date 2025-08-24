import { ApiProperty } from '@nestjs/swagger';

export class UploadCompleteResponseDto {
  @ApiProperty({
    description: 'Asset ID created in the database',
    example: 'cmeq1wmrw0001z97fu028bcd5',
    pattern: '^[a-zA-Z0-9]{25}$',
  })
  assetId: string;

  @ApiProperty({
    description: 'Object key of the uploaded file',
    example: 'uploads/2025/08/25/a86ee7b6-6a87-41d9-b6d8-184b8b30d1bc-test.pdf',
  })
  objectKey: string;

  @ApiProperty({
    description: 'Current status of the asset',
    example: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'],
    enumName: 'AssetStatus',
  })
  status: string;

  @ApiProperty({
    description: 'Message indicating the upload was completed successfully',
    example: 'File uploaded successfully and queued for processing',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp when the upload was completed',
    example: '2025-08-24T18:58:05.517Z',
    format: 'date-time',
  })
  completedAt: string;
}

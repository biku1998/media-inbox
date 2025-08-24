import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { UploadCompleteResponseDto } from './dto/upload-complete-response.dto';
import { Request as TypedRequest } from 'src/types';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @ApiOperation({
    summary: 'Generate presigned URL for file upload',
    description:
      'Creates a presigned PUT URL for uploading files directly to S3/MinIO. ' +
      'The URL allows clients to upload files without exposing S3 credentials. ' +
      'File type and size validation is performed before generating the URL.',
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully',
    type: PresignResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async generatePresignedUrl(
    @Body() presignDto: PresignUploadDto,
  ): Promise<PresignResponseDto> {
    return this.uploadsService.generatePresignedUploadUrl(presignDto);
  }

  @Post('complete')
  @ApiOperation({
    summary: 'Complete file upload and create asset record',
    description:
      'Marks the upload as complete and creates an asset record for processing. ' +
      'This endpoint should be called after successfully uploading a file using the presigned URL. ' +
      'The asset is created with PENDING status and will be queued for background processing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Upload completed successfully',
    type: UploadCompleteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file data or validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async completeUpload(
    @Body() uploadCompleteDto: UploadCompleteDto,
    @Request() req: TypedRequest,
  ): Promise<UploadCompleteResponseDto> {
    return this.uploadsService.completeUpload(uploadCompleteDto, req.user.id);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Test S3 connection',
    description:
      'Checks if S3/MinIO connection is working properly. ' +
      'Useful for monitoring and debugging S3 connectivity issues.',
  })
  @ApiResponse({
    status: 200,
    description: 'S3 connection test result',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        connected: { type: 'boolean' },
        timestamp: { type: 'string' },
      },
    },
  })
  async testS3Connection() {
    const connected = await this.uploadsService.testS3Connection();
    return {
      status: connected ? 'connected' : 'disconnected',
      connected,
      timestamp: new Date().toISOString(),
    };
  }
}

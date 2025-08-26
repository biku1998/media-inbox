import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { UploadCompleteResponseDto } from './dto/upload-complete-response.dto';
import { Request as TypedRequest } from 'src/types';

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate presigned upload URL',
    description: 'Generate a presigned URL for direct S3 upload',
  })
  @ApiBody({ type: PresignUploadDto })
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
    @Request() req: TypedRequest,
  ): Promise<PresignResponseDto> {
    const userId = req.user.id;
    return this.uploadsService.generatePresignedUploadUrl(presignDto, userId);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete file upload',
    description: 'Mark upload as complete and queue for processing',
  })
  @ApiBody({ type: UploadCompleteDto })
  @ApiResponse({
    status: 201,
    description: 'Upload completed successfully',
    type: UploadCompleteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async completeUpload(
    @Body() uploadCompleteDto: UploadCompleteDto,
    @Request() req: TypedRequest,
  ): Promise<UploadCompleteResponseDto> {
    const userId = req.user.id;
    return this.uploadsService.completeUpload(uploadCompleteDto, userId);
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test S3 connection',
    description: 'Test the connection to S3 storage',
  })
  @ApiResponse({
    status: 200,
    description: 'S3 connection test result',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async testS3Connection() {
    const connected = await this.uploadsService.testS3Connection();
    return {
      connected,
      message: connected ? 'S3 connection successful' : 'S3 connection failed',
    };
  }
}

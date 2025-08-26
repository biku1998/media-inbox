import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get job queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Job queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        waiting: { type: 'number' },
        active: { type: 'number' },
        completed: { type: 'number' },
        failed: { type: 'number' },
        delayed: { type: 'number' },
      },
    },
  })
  async getJobStats() {
    return this.jobsService.getJobStats();
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get job details by ID' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.jobsService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return job;
  }

  @Post(':jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be retried',
  })
  async retryJob(@Param('jobId') jobId: string) {
    const success = await this.jobsService.retryJob(jobId);
    if (success) {
      return { message: 'Job retry initiated successfully' };
    }
    return { error: 'Job cannot be retried or not found' };
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a job from the queue' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job removed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async removeJob(@Param('jobId') jobId: string) {
    const success = await this.jobsService.removeJob(jobId);
    if (success) {
      return { message: 'Job removed successfully' };
    }
    return { error: 'Job not found' };
  }

  @Get('asset/:assetId')
  @ApiOperation({ summary: 'Get all jobs for a specific asset' })
  @ApiParam({ name: 'assetId', description: 'Asset ID' })
  @ApiResponse({
    status: 200,
    description: 'Asset jobs retrieved successfully',
  })
  async getAssetJobs(@Param('assetId') assetId: string) {
    return this.jobsService.getAssetJobs(assetId);
  }

  @Get('database/all')
  @ApiOperation({ summary: 'Get all database job records with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Database jobs retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  async getAllDatabaseJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    return this.jobsService.getAllJobs(pageNum, limitNum);
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old completed jobs' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Days old (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
  })
  @Roles(UserRole.ADMIN)
  async cleanupOldJobs(@Query('days') days: string = '30') {
    const daysNum = parseInt(days, 10) || 30;
    const count = await this.jobsService.cleanupOldJobs(daysNum);
    return { message: `Cleaned up ${count} old completed jobs` };
  }
}

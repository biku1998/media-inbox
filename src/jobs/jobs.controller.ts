import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  JobsService,
  JobStatusResponse,
  QueueStatsResponse,
} from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('stats')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get queue statistics',
    description:
      'Returns current queue statistics for all job types (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        waiting: { type: 'number', description: 'Number of waiting jobs' },
        active: { type: 'number', description: 'Number of active jobs' },
        completed: { type: 'number', description: 'Number of completed jobs' },
        failed: { type: 'number', description: 'Number of failed jobs' },
        delayed: { type: 'number', description: 'Number of delayed jobs' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getQueueStats(): Promise<QueueStatsResponse> {
    return this.jobsService.getQueueStats();
  }

  @Get(':jobId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Returns detailed status of a specific job (Admin only)',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to retrieve status for',
    example: '123',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Job ID' },
        status: { type: 'string', description: 'Current job status' },
        progress: { type: 'number', description: 'Job progress (0-100)' },
        data: { type: 'object', description: 'Job data' },
        failedReason: {
          type: 'string',
          description: 'Failure reason if job failed',
        },
        processedOn: {
          type: 'string',
          format: 'date-time',
          description: 'When job was processed',
        },
        finishedOn: {
          type: 'string',
          format: 'date-time',
          description: 'When job finished',
        },
        attemptsMade: {
          type: 'number',
          description: 'Number of attempts made',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<JobStatusResponse> {
    return this.jobsService.getJobStatus(jobId);
  }

  @Post(':jobId/retry')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retries a failed job (Admin only)',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to retry',
    example: '123',
  })
  @ApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Job cannot be retried',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async retryJob(@Param('jobId') jobId: string): Promise<{ message: string }> {
    await this.jobsService.retryFailedJob(jobId);
    return { message: 'Job retry initiated successfully' };
  }

  @Delete(':jobId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Remove job',
    description: 'Removes a job from the queue (Admin only)',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to remove',
    example: '123',
  })
  @ApiResponse({
    status: 200,
    description: 'Job removed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async removeJob(@Param('jobId') jobId: string): Promise<{ message: string }> {
    await this.jobsService.removeJob(jobId);
    return { message: 'Job removed successfully' };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';

export interface MediaProcessingJobData {
  assetId: string;
  objectKey: string;
  mimeType: string;
  originalFilename: string;
}

export interface JobStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('media-processing') private mediaProcessingQueue: Queue,
    private prisma: PrismaService,
  ) {}

  /**
   * Add a media processing job to the queue
   */
  async addMediaProcessingJob(data: MediaProcessingJobData): Promise<string> {
    const jobId = `media-${data.assetId}`;

    this.logger.log(`Adding media processing job for asset: ${data.assetId}`);

    const job = await this.mediaProcessingQueue.add('process-media', data, {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(`Media processing job added with ID: ${job.id}`);
    return job.id as string;
  }

  /**
   * Get job statistics from the queue
   */
  async getJobStats(): Promise<JobStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.mediaProcessingQueue.getWaiting(),
      this.mediaProcessingQueue.getActive(),
      this.mediaProcessingQueue.getCompleted(),
      this.mediaProcessingQueue.getFailed(),
      this.mediaProcessingQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: string) {
    const job = await this.mediaProcessingQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    // Get database job record if it exists
    const dbJob = await this.prisma.job.findFirst({
      where: {
        assetId: (job.data as MediaProcessingJobData).assetId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: job.id,
      name: job.name,
      data: job.data as MediaProcessingJobData,
      state: await job.getState(),
      progress: job.progress() as number,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      databaseJob: dbJob,
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.mediaProcessingQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    const jobState = await job.getState();
    if (jobState === 'failed') {
      await job.retry();
      return true;
    }

    return false;
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.mediaProcessingQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Get database job records for an asset
   */
  async getAssetJobs(assetId: string) {
    return this.prisma.job.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all database job records with pagination
   */
  async getAllJobs(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              objectKey: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.job.count(),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Clean up old completed jobs (optional maintenance)
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.job.deleteMany({
      where: {
        state: 'COMPLETED',
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old completed jobs`);
    return result.count;
  }
}

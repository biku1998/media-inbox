import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { ConfigService } from '@nestjs/config';

export interface MediaProcessingJobData {
  assetId: string;
  objectKey: string;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
}

export interface JobStatusResponse {
  id?: string | number;
  status: string;
  progress?: number;
  data?: MediaProcessingJobData;
  failedReason?: string;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade?: number;
}

export interface QueueStatsResponse {
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
    private configService: ConfigService,
  ) {}

  async addMediaProcessingJob(jobData: MediaProcessingJobData): Promise<Job> {
    this.logger.log(
      `Adding media processing job for asset: ${jobData.assetId}`,
    );

    const job = await this.mediaProcessingQueue.add('process-media', jobData, {
      jobId: `media-${jobData.assetId}`, // Ensure idempotency
      priority: this.getJobPriority(jobData.mimeType),
      delay: 1000, // 1 second delay to ensure file is fully uploaded
    });

    this.logger.log(`Media processing job added with ID: ${job.id}`);
    return job;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const job = await this.mediaProcessingQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress() as number,
      data: job.data as MediaProcessingJobData,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }

  async getQueueStats(): Promise<QueueStatsResponse> {
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

  async retryFailedJob(jobId: string): Promise<void> {
    const job = await this.mediaProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if ((await job.getState()) !== 'failed') {
      throw new Error('Job is not in failed state');
    }

    await job.retry();
    this.logger.log(`Retrying failed job: ${jobId}`);
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.mediaProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    this.logger.log(`Removed job: ${jobId}`);
  }

  private getJobPriority(mimeType: string): number {
    // Higher priority for images (lower number = higher priority)
    if (mimeType.startsWith('image/')) {
      return 1;
    }
    // Medium priority for documents
    if (mimeType.includes('pdf') || mimeType.includes('document')) {
      return 2;
    }
    // Lower priority for other files
    return 3;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvValidationService {
  private readonly logger = new Logger(EnvValidationService.name);

  constructor(private configService: ConfigService) {}

  validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'REDIS_HOST',
      'REDIS_PORT',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'S3_BUCKET_NAME',
    ];

    const missingVars: string[] = [];

    for (const envVar of requiredEnvVars) {
      const value = this.configService.get<string>(envVar);
      if (!value) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('✅ All required environment variables are set');

    // Log configuration summary
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const dbHost = dbUrl?.split('@')[1] || 'configured';
    this.logger.log(`Database: ${dbHost}`);
    this.logger.log(
      `Redis: ${this.configService.get('REDIS_HOST')}:${this.configService.get('REDIS_PORT')}`,
    );
    this.logger.log(`S3 Bucket: ${this.configService.get('S3_BUCKET_NAME')}`);
    this.logger.log(`AWS Region: ${this.configService.get('AWS_REGION')}`);
  }
}

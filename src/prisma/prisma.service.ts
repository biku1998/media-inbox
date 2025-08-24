import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // await this.$connect();
    await this.connectWithRetry();
  }

  private async connectWithRetry(
    retries: number = 5,
    delay: number = 2000,
  ): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      if (retries <= 0) {
        this.logger.error(
          'Could not connect to the database. Exiting now...',
          error,
        );
        throw error;
      }
      this.logger.warn(
        `Database connection failed. Retrying in ${delay / 1000} seconds...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.connectWithRetry(retries - 1, delay);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

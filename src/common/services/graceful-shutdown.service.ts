import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/common/cache/cache.service';

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}`);

    try {
      // Close database connections
      this.logger.log('Closing database connections...');
      await this.prismaService.$disconnect();
      this.logger.log('✅ Database connections closed');

      // Close Redis connections
      this.logger.log('Closing Redis connections...');
      await this.cacheService.close();
      this.logger.log('✅ Redis connections closed');

      this.logger.log('🎉 Graceful shutdown completed');
    } catch (error) {
      this.logger.error('❌ Error during graceful shutdown:', error);
    }
  }
}

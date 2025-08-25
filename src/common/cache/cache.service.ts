import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTTL: number;

  constructor(private configService: ConfigService) {
    this.defaultTTL = this.configService.get<number>('CACHE_TTL', 300); // 5 minutes default

    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD', ''),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(value) as T;
      }
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const cacheTTL = ttl || this.defaultTTL;

      await this.redis.setex(key, cacheTTL, serializedValue);
      this.logger.debug(`Cache set for key: ${key} with TTL: ${cacheTTL}s`);
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(
          `Cache deleted ${keys.length} keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  async invalidateAsset(assetId: string): Promise<void> {
    const pattern = `asset:${assetId}:*`;
    await this.deletePattern(pattern);
    this.logger.debug(`Invalidated cache for asset: ${assetId}`);
  }

  async invalidateUserAssets(userId: string): Promise<void> {
    const pattern = `user:${userId}:assets:*`;
    await this.deletePattern(pattern);
    this.logger.debug(`Invalidated cache for user assets: ${userId}`);
  }

  generateAssetKey(assetId: string): string {
    return `asset:${assetId}:details`;
  }

  generateUserAssetsKey(userId: string, query: string): string {
    return `user:${userId}:assets:${query}`;
  }

  async getAsset<T>(assetId: string): Promise<T | null> {
    const key = this.generateAssetKey(assetId);
    return this.get<T>(key);
  }

  async setAsset(assetId: string, value: any, ttl?: number): Promise<void> {
    const key = this.generateAssetKey(assetId);
    await this.set(key, value, ttl);
  }

  async getUserAssets<T>(userId: string, query: string): Promise<T | null> {
    const key = this.generateUserAssetsKey(userId, query);
    return this.get<T>(key);
  }

  async setUserAssets(
    userId: string,
    query: string,
    value: any,
    ttl?: number,
  ): Promise<void> {
    const key = this.generateUserAssetsKey(userId, query);
    await this.set(key, value, ttl);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }
}

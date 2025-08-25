import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { Request } from 'src/types/express';

export interface RateLimitOptions {
  ttl: number; // Time window in seconds
  limit: number; // Maximum requests per time window
  key?: string; // Custom key for rate limiting
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const options = this.getRateLimitOptions(request);

    if (options) {
      await this.checkRateLimit(request, options);
    }

    return next.handle();
  }

  private safeRoutePath(req: Request): string {
    const routeUnknown = req.route as unknown;

    if (typeof routeUnknown === 'object' && routeUnknown !== null) {
      const maybePath = (routeUnknown as { path?: unknown }).path;
      if (typeof maybePath === 'string') return maybePath;
    }

    // fallbacks are properly typed strings in Express
    return req.path ?? req.originalUrl ?? req.url ?? 'unknown';
  }

  private getRateLimitOptions(request: Request): RateLimitOptions | null {
    const route = this.safeRoutePath(request);

    // Rate limiting rules for different endpoints
    if (route === '/auth/login' || route === '/auth/register') {
      return { ttl: 60, limit: 5 }; // 5 attempts per minute for auth
    }

    if (route === '/uploads/presign') {
      return { ttl: 60, limit: 20 }; // 20 presign requests per minute
    }

    if (route === '/auth/refresh') {
      return { ttl: 60, limit: 10 }; // 10 refresh attempts per minute
    }

    // Global rate limit for other endpoints
    return { ttl: 60, limit: 100 }; // 100 requests per minute
  }

  private async checkRateLimit(
    request: Request,
    options: RateLimitOptions,
  ): Promise<void> {
    const key = this.generateRateLimitKey(request);
    const currentCount = (await this.cacheService.get<number>(key)) || 0;

    if (currentCount >= options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    await this.cacheService.set(key, currentCount + 1, options.ttl);
  }

  private generateRateLimitKey(request: Request): string {
    const userId = request.user?.id || 'anonymous';
    const ip = request.ip || 'unknown';
    const route = this.safeRoutePath(request);

    return `rate_limit:${userId}:${ip}:${route}`;
  }
}

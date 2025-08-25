import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate unique request ID
    const requestId = uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-ID', requestId);

    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const startTime = Date.now();

    this.logger.log(
      `[${requestId}] ${method} ${url} - ${ip} - ${userAgent}`,
      'Request',
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(
          `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms`,
          'Response',
        );
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const errorObj = error as {
          status?: number;
          message?: string;
          stack?: string;
        };
        const statusCode = errorObj?.status || 500;

        this.logger.error(
          `[${requestId}] ${method} ${url} - ${statusCode} - ${duration}ms - Error: ${errorObj?.message || 'Unknown error'}`,
          errorObj?.stack || 'No stack trace',
          'Error',
        );

        throw error;
      }),
    );
  }
}

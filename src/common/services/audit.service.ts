import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AuditEvent {
  actorId: string; // Keep required for database constraint
  action: string;
  subject: string;
  payload?: Record<string, any>;
}

export interface AuditLogQuery {
  actorId?: string;
  action?: string;
  subject?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  id: string;
  actorId: string;
  action: string;
  subject: string;
  payload: Record<string, any> | null;
  createdAt: Date;
  actor: {
    id: string;
    email: string;
    role: string;
  };
}

// Properly typed interfaces for different event types
export interface AuthEventDetails {
  ipAddress?: string;
  userAgent?: string;
  email?: string;
  role?: string;
  reason?: string;
  refreshTokenRevoked?: boolean;
}

export interface FileEventDetails {
  fileSize?: number;
  mimeType?: string;
  contentType?: string; // Add this for compatibility
  filename?: string;
  objectKey?: string;
  assetId?: string;
  jobEnqueued?: boolean;
}

export interface JobEventDetails {
  jobId?: string;
  attempts?: number;
  objectKey?: string;
  originalFilename?: string;
  thumbnailKey?: string;
  processingMeta?: Record<string, any>;
  error?: string;
}

export interface AdminEventDetails {
  targetUserId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface PrismaWhereClause {
  actorId?: string;
  action?: string;
  subject?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: event.actorId,
          action: event.action,
          subject: event.subject,
          payload: event.payload || undefined,
        },
      });

      this.logger.debug(
        `Audit logged: ${event.actorId} performed ${event.action} on ${event.subject}`,
      );
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to log audit event: ${errorMessage}`);
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    actorId: string,
    action:
      | 'LOGIN_SUCCESS'
      | 'LOGIN_FAILED'
      | 'LOGOUT'
      | 'PASSWORD_CHANGE'
      | 'REGISTER',
    details?: AuthEventDetails,
  ): Promise<void> {
    const payload: Record<string, any> = {
      event: action,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      if (details.ipAddress) payload.ipAddress = details.ipAddress;
      if (details.userAgent) payload.userAgent = details.userAgent;
      if (details.email) payload.email = details.email;
      if (details.role) payload.role = details.role;
      if (details.reason) payload.reason = details.reason;
      if (details.refreshTokenRevoked !== undefined) {
        payload.refreshTokenRevoked = details.refreshTokenRevoked;
      }
    }

    await this.logEvent({
      actorId,
      action,
      subject: 'AUTH',
      payload,
    });
  }

  /**
   * Log file operation events
   */
  async logFileEvent(
    actorId: string,
    action:
      | 'UPLOAD_START'
      | 'UPLOAD_COMPLETE'
      | 'UPLOAD_FAILED'
      | 'DELETE'
      | 'STATUS_CHANGE',
    subject: string,
    details?: FileEventDetails,
  ): Promise<void> {
    const payload: Record<string, any> = {
      event: action,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      if (details.fileSize !== undefined) payload.fileSize = details.fileSize;
      if (details.mimeType) payload.mimeType = details.mimeType;
      if (details.filename) payload.filename = details.filename;
      if (details.objectKey) payload.objectKey = details.objectKey;
      if (details.assetId) payload.assetId = details.assetId;
      if (details.jobEnqueued !== undefined) {
        payload.jobEnqueued = details.jobEnqueued;
      }
    }

    await this.logEvent({
      actorId,
      action,
      subject,
      payload,
    });
  }

  /**
   * Log job processing events
   */
  async logJobEvent(
    actorId: string,
    action:
      | 'JOB_CREATED'
      | 'JOB_STARTED'
      | 'JOB_COMPLETED'
      | 'JOB_FAILED'
      | 'JOB_RETRY',
    subject: string,
    details?: JobEventDetails,
  ): Promise<void> {
    const payload: Record<string, any> = {
      event: action,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      if (details.jobId) payload.jobId = details.jobId;
      if (details.attempts !== undefined) payload.attempts = details.attempts;
      if (details.objectKey) payload.objectKey = details.objectKey;
      if (details.originalFilename)
        payload.originalFilename = details.originalFilename;
      if (details.thumbnailKey) payload.thumbnailKey = details.thumbnailKey;
      if (details.processingMeta)
        payload.processingMeta = details.processingMeta;
      if (details.error) payload.error = details.error;
    }

    await this.logEvent({
      actorId,
      action,
      subject,
      payload,
    });
  }

  /**
   * Log administrative events
   */
  async logAdminEvent(
    actorId: string,
    action:
      | 'USER_CREATED'
      | 'USER_UPDATED'
      | 'USER_DELETED'
      | 'ROLE_CHANGED'
      | 'SYSTEM_CONFIG',
    subject: string,
    details?: AdminEventDetails,
  ): Promise<void> {
    const payload: Record<string, any> = {
      event: action,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      if (details.targetUserId) payload.targetUserId = details.targetUserId;
      if (details.oldValue !== undefined) payload.oldValue = details.oldValue;
      if (details.newValue !== undefined) payload.newValue = details.newValue;
    }

    await this.logEvent({
      actorId,
      action,
      subject,
      payload,
    });
  }

  /**
   * Log system events (e.g., application startup, shutdown)
   */
  async logSystemEvent(
    actorId: string,
    action: string,
    subject: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      actorId,
      action,
      subject,
      payload: details,
    });
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(query: AuditLogQuery = {}): Promise<{
    logs: AuditLogResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const {
      actorId,
      action,
      subject,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause with proper typing
    const where: PrismaWhereClause = {};
    if (actorId) {
      where.actorId = actorId;
    }
    if (action) {
      where.action = action;
    }
    if (subject) {
      where.subject = subject;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs as AuditLogResponse[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    logs: AuditLogResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return this.getAuditLogs({ actorId: userId, page, limit });
  }

  /**
   * Get audit logs for a specific asset
   */
  async getAssetAuditLogs(
    assetId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    logs: AuditLogResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return this.getAuditLogs({ subject: assetId, page, limit });
  }

  /**
   * Clean up old audit logs (for data retention)
   */
  async cleanupOldLogs(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} old audit logs (older than ${daysOld} days)`,
    );
    return result.count;
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(): Promise<{
    totalLogs: number;
    todayLogs: number;
    topActions: Array<{ action: string; count: number }>;
    topActors: Array<{ actorId: string; email: string; count: number }>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, topActions, topActors] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        _count: { actorId: true },
        orderBy: { _count: { actorId: 'desc' } },
        take: 10,
      }),
    ]);

    // Get user details for top actors
    const topActorDetails = await Promise.all(
      topActors.map(async (actor) => {
        const user = await this.prisma.user.findUnique({
          where: { id: actor.actorId },
          select: { email: true },
        });
        return {
          actorId: actor.actorId,
          email: user?.email || 'Unknown',
          count: actor._count.actorId,
        };
      }),
    );

    return {
      totalLogs,
      todayLogs,
      topActions: topActions.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
      topActors: topActorDetails,
    };
  }
}

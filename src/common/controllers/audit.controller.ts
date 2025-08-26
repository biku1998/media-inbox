import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditService, AuditLogQuery } from '../services/audit.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs with filtering and pagination' })
  @ApiQuery({
    name: 'actorId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filter by action type',
  })
  @ApiQuery({
    name: 'subject',
    required: false,
    description: 'Filter by subject',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  async getAuditLogs(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('subject') subject?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const query: AuditLogQuery = {
      actorId,
      action,
      subject,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page || 1,
      limit: limit || 20,
    };

    return this.auditService.getAuditLogs(query);
  }

  @Get('logs/user/:userId')
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'User audit logs retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.auditService.getUserAuditLogs(userId, page || 1, limit || 20);
  }

  @Get('logs/asset/:assetId')
  @ApiOperation({ summary: 'Get audit logs for a specific asset' })
  @ApiParam({ name: 'assetId', description: 'Asset ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset audit logs retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  async getAssetAuditLogs(
    @Param('assetId') assetId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.auditService.getAssetAuditLogs(assetId, page || 1, limit || 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiResponse({
    status: 200,
    description: 'Audit statistics retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  async getAuditStats() {
    return this.auditService.getAuditStats();
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old audit logs' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Days old (default: 90)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
  })
  @Roles(UserRole.ADMIN)
  async cleanupOldLogs(
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    const daysOld = days || 90;
    const count = await this.auditService.cleanupOldLogs(daysOld);
    return {
      message: `Cleaned up ${count} old audit logs (older than ${daysOld} days)`,
      count,
    };
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get list of available audit actions' })
  @ApiResponse({
    status: 200,
    description: 'Available actions retrieved successfully',
  })
  @Roles(UserRole.ADMIN)
  getAvailableActions() {
    return {
      actions: [
        // Authentication actions
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'REGISTER',
        // File operations
        'UPLOAD_START',
        'UPLOAD_COMPLETE',
        'UPLOAD_FAILED',
        'DELETE',
        'STATUS_CHANGE',
        // Job processing
        'JOB_CREATED',
        'JOB_STARTED',
        'JOB_COMPLETED',
        'JOB_FAILED',
        'JOB_RETRY',
        // Administrative
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'ROLE_CHANGED',
        'SYSTEM_CONFIG',
      ],
    };
  }
}

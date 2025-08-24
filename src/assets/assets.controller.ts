import {
  Controller,
  Get,
  Param,
  Query,
  Delete,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request as TypedRequest } from 'src/types';
import { AssetsService } from './assets.service';
import { ListAssetsDto } from './dto/list-assets.dto';
import { ListAssetsResponseDto } from './dto/list-assets-response.dto';
import { AssetResponseDto } from './dto/asset-response.dto';
import { AssetStatus } from '@prisma/client';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({
    summary: 'List user assets',
    description:
      'Retrieve a paginated list of assets owned by the authenticated user. ' +
      'Supports filtering by status, MIME type, and search by filename. ' +
      'Uses cursor-based pagination for efficient navigation.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of assets to return (max 50)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by asset status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by filename',
  })
  @ApiQuery({
    name: 'mimeType',
    required: false,
    description: 'Filter by MIME type',
  })
  @ApiResponse({
    status: 200,
    description: 'Assets retrieved successfully',
    type: ListAssetsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async listAssets(
    @Query() query: ListAssetsDto,
    @Request() req: TypedRequest,
  ): Promise<ListAssetsResponseDto> {
    return this.assetsService.listAssets(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get asset by ID',
    description:
      'Retrieve a specific asset by ID. Only accessible by the asset owner. ' +
      'Returns the asset with signed download and thumbnail URLs.',
  })
  @ApiParam({
    name: 'id',
    description: 'Asset ID to retrieve',
    example: 'cmeq1wmrw0001z97fu028bcd5',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset retrieved successfully',
    type: AssetResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - access denied to this asset',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async getAssetById(
    @Param('id') id: string,
    @Request() req: TypedRequest,
  ): Promise<AssetResponseDto> {
    return this.assetsService.getAssetById(id, req.user.id);
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Update asset status',
    description:
      'Update the status of an asset. Only accessible by the asset owner. ' +
      'Useful for marking assets as processed or failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Asset ID to update',
    example: 'cmeq1wmrw0001z97fu028bcd5',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset status updated successfully',
    type: AssetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status value',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - access denied to this asset',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async updateAssetStatus(
    @Param('id') id: string,
    @Body('status') status: AssetStatus,
    @Request() req: TypedRequest,
  ): Promise<AssetResponseDto> {
    return this.assetsService.updateAssetStatus(id, req.user.id, status);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete asset',
    description:
      'Delete an asset and its associated files from S3. ' +
      'Only accessible by the asset owner. This action cannot be undone.',
  })
  @ApiParam({
    name: 'id',
    description: 'Asset ID to delete',
    example: 'cmeq1wmrw0001z97fu028bcd5',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Asset deleted successfully' },
        assetId: { type: 'string', example: 'cmeq1wmrw0001z97fu028bcd5' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - access denied to this asset',
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found',
  })
  async deleteAsset(
    @Param('id') id: string,
    @Request() req: TypedRequest,
  ): Promise<{ message: string; assetId: string }> {
    await this.assetsService.deleteAsset(id, req.user.id);
    return {
      message: 'Asset deleted successfully',
      assetId: id,
    };
  }
}

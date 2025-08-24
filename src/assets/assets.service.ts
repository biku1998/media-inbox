import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';
import { ListAssetsDto } from './dto/list-assets.dto';
import { AssetResponseDto } from './dto/asset-response.dto';
import { ListAssetsResponseDto } from './dto/list-assets-response.dto';
import { AssetStatus, Asset, User } from '@prisma/client';

type AssetWithOwner = Asset & {
  owner: Pick<User, 'id' | 'email'>;
};

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async listAssets(
    userId: string,
    query: ListAssetsDto,
  ): Promise<ListAssetsResponseDto> {
    const { cursor, limit = 20, status, search, mimeType } = query;

    // Build where clause with user isolation
    const where: any = {
      ownerId: userId,
    };

    if (status) {
      where.status = status;
    }

    if (mimeType) {
      where.mime = mimeType;
    }

    if (search) {
      where.meta = {
        path: ['originalFilename'],
        string_contains: search,
      };
    }

    // Get total count
    const total = await this.prisma.asset.count({ where });

    // Build pagination
    const take = Math.min(limit, 50);
    const skip = cursor ? 1 : 0;

    // Get assets with pagination
    const assets = (await this.prisma.asset.findMany({
      where,
      take,
      skip,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })) as AssetWithOwner[];

    // Generate signed URLs for each asset
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => this.mapToAssetResponse(asset)),
    );

    // Calculate pagination info
    const hasNext = assets.length === take;
    const hasPrev = !!cursor;
    const nextCursor = hasNext ? assets[assets.length - 1]?.id : undefined;
    const prevCursor = hasPrev ? assets[0]?.id : undefined;
    const page = Math.floor((total - assets.length) / take) + 1;
    const totalPages = Math.ceil(total / take);

    return {
      assets: assetsWithUrls,
      total,
      count: assets.length,
      nextCursor,
      prevCursor,
      page,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  async getAssetById(
    assetId: string,
    userId: string,
  ): Promise<AssetResponseDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Ensure user can only access their own assets
    if (asset.ownerId !== userId) {
      throw new ForbiddenException('Access denied to this asset');
    }

    return this.mapToAssetResponse(asset);
  }

  async deleteAsset(assetId: string, userId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Ensure user can only delete their own assets
    if (asset.ownerId !== userId) {
      throw new ForbiddenException('Access denied to this asset');
    }

    // Delete from S3 first
    try {
      await this.s3Service.deleteObject(asset.objectKey);
      if (asset.thumbKey) {
        await this.s3Service.deleteObject(asset.thumbKey);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 objects for asset ${assetId}:`,
        error,
      );
    }

    // Delete from database
    await this.prisma.asset.delete({
      where: { id: assetId },
    });

    this.logger.log(`Asset ${assetId} deleted by user ${userId}`);
  }

  async updateAssetStatus(
    assetId: string,
    userId: string,
    status: AssetStatus,
  ): Promise<AssetResponseDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Ensure user can only update their own assets
    if (asset.ownerId !== userId) {
      throw new ForbiddenException('Access denied to this asset');
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: { status },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.mapToAssetResponse(updatedAsset);
  }

  private async mapToAssetResponse(
    asset: AssetWithOwner,
  ): Promise<AssetResponseDto> {
    // Generate signed URLs
    const downloadUrl = await this.s3Service.generatePresignedGetUrl(
      asset.objectKey,
      3600, // 1 hour expiration
    );

    let thumbnailUrl: string | undefined;
    if (asset.thumbKey) {
      thumbnailUrl = await this.s3Service.generatePresignedGetUrl(
        asset.thumbKey,
        3600, // 1 hour expiration
      );
    }

    return {
      id: asset.id,
      objectKey: asset.objectKey,
      mime: asset.mime,
      size: asset.size,
      status: asset.status,
      thumbKey: asset.thumbKey,
      meta: asset.meta,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      downloadUrl,
      thumbnailUrl,
    };
  }
}

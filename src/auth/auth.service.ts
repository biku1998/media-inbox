import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/auth/user.service';
import { LoginDto } from 'src/auth/dto/login.dto';
import { CreateUserDto } from 'src/auth/dto/create-user.dto';
import { AuthResponseDto } from 'src/auth/dto/auth-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponseDto> {
    // Create user
    const user = await this.userService.createUser(createUserDto);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.userService.validatePassword(
      user,
      password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    // Return user without password hash
    const userResponse = await this.userService.findUserById(user.id);

    return {
      accessToken,
      refreshToken,
      user: userResponse,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if token exists in database and is not revoked
      const hashedToken = this.hashToken(refreshToken);

      const session = await this.prisma.session.findFirst({
        where: {
          userId: payload.sub,
          refreshTokenHash: hashedToken,
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.userService.findUserById(payload.sub);

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Revoke old refresh token and store new one
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.storeRefreshToken(user.id, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m',
    });
  }

  private generateRefreshToken(user: { id: string }): string {
    const payload = {
      sub: user.id,
      iat: Date.now(), // Add current timestamp to ensure uniqueness
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashedToken,
        expiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    // Use a simple hash for tokens since we need deterministic hashing
    // bcrypt generates different hashes for the same input due to random salt
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'securePassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'User role (optional, defaults to USER)',
    example: 'USER',
    enum: UserRole,
    enumName: 'UserRole',
    default: 'USER',
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either USER or ADMIN' })
  role?: UserRole;
}

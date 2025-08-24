import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: 'cmeq1ozf60000z9dbdzf42dn0',
    pattern: '^[a-zA-Z0-9]{25}$',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'USER',
    enum: UserRole,
    enumName: 'UserRole',
  })
  role: UserRole;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2025-08-24T18:52:08.659Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2025-08-24T18:52:08.659Z',
    format: 'date-time',
  })
  updatedAt: Date;
}

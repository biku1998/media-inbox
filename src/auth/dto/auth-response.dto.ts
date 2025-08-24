import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWVxMW96ZjYwMDAwejlkYmR6ZjQyZG4wIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NTYwNjE1MjgsImV4cCI6MTc1NjA2MjQyOH0.ZXXEAo8rYDiplT2qVnL_jeicVN0YS5wVWY9Wv9zq6aE',
    minLength: 1,
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for obtaining new access tokens',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWVxMW96ZjYwMDAwejlkYmR6ZjQyZG4wIiwiaWF0IjoxNzU2MDYxNTI4NjcxLCJleHAiOjE3NTYwNjIxMzM0NzF9.KPpFRY_2ytsV_IiIWd2W3eFtRe0Inrz22sxF1jiaQpU',
    minLength: 1,
  })
  refreshToken: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;
}

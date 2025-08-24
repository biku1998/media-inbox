import { Module } from '@nestjs/common';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { AppConfigModule } from 'src/common/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HealthController } from 'src/common/health/health.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

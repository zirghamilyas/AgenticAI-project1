import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Registers `HealthController` only. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

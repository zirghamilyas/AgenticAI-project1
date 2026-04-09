import { Controller, Get } from '@nestjs/common';

/** Minimal liveness endpoint for load balancers and manual checks. */
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

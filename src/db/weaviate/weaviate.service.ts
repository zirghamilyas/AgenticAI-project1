import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connectToLocal, type WeaviateClient } from 'weaviate-client';
import { AGENT_KNOWLEDGE_COLLECTION } from '../../common/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Owns the process-wide `WeaviateClient`. Retries `connectToLocal` so Docker can start late;
 * then polls `isReady()` until the instance accepts traffic.
 */
@Injectable()
export class WeaviateService implements OnModuleInit {
  private readonly logger = new Logger(WeaviateService.name);
  private client!: WeaviateClient;

  constructor(private readonly config: ConfigService) {}

  /** Blocks app startup until Weaviate is reachable or retry budget is exhausted. */
  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('WEAVIATE_HTTP_HOST', 'localhost');
    const port = this.config.get<number>('WEAVIATE_HTTP_PORT', 8080);
    const grpcPort = this.config.get<number>('WEAVIATE_GRPC_PORT', 50051);
    /** ~2 minutes total; covers “start Docker then the API” without crashing immediately. */
    const maxConnectAttempts = 120;
    const connectDelayMs = 1000;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxConnectAttempts; attempt++) {
      try {
        this.client = await connectToLocal({
          host,
          port,
          grpcPort,
          skipInitChecks: false,
        });
        await this.waitUntilReady(30, 500);
        this.logger.log(`Connected to Weaviate at ${host}:${port} (gRPC ${grpcPort})`);
        return;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Weaviate not reachable at http://${host}:${port} (attempt ${attempt}/${maxConnectAttempts}). ` +
            `Start it with: docker compose up -d  —  ${msg}`,
        );
        if (attempt < maxConnectAttempts) {
          await sleep(connectDelayMs);
        }
      }
    }
    throw new Error(
      `Weaviate did not become available after ${maxConnectAttempts} attempts (~${Math.ceil((maxConnectAttempts * connectDelayMs) / 60000)} min). ` +
        `Ensure Docker is running and Weaviate is up: docker compose up -d. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  /** Polls `client.isReady()` after TCP connect (handles slow container readiness). */
  private async waitUntilReady(maxAttempts: number, delayMs: number): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const ready = await this.client.isReady();
        if (ready) {
          return;
        }
      } catch {
        // retry
      }
      this.logger.warn(
        `Weaviate not ready yet (attempt ${i + 1}/${maxAttempts}), retrying...`,
      );
      await sleep(delayMs);
    }
    throw new Error('Weaviate did not become ready in time.');
  }

  /** Raw client for schema scripts and advanced use. */
  getClient(): WeaviateClient {
    return this.client;
  }

  /**
   * Required for multi-tenant data: all reads/writes must go through `withTenant(tenantId)`.
   */
  getKnowledgeCollectionForTenant(tenantId: string) {
    return this.client.collections
      .use(AGENT_KNOWLEDGE_COLLECTION)
      .withTenant(tenantId);
  }
}

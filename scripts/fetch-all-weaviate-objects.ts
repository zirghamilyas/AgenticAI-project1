/**
 * Connects to local Weaviate (Docker) and fetches all objects from the
 * tenant-scoped AgentKnowledge collection — useful for manual testing.
 *
 * Uses the same env vars as the app: WEAVIATE_HTTP_HOST, WEAVIATE_HTTP_PORT,
 * WEAVIATE_GRPC_PORT. Optional: WEAVIATE_TENANT_ID (defaults to tenant-demo).
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/fetch-all-weaviate-objects.ts
 * Or:  npm run weaviate:fetch-all
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { connectToLocal } from 'weaviate-client';
import {
  AGENT_KNOWLEDGE_COLLECTION,
  DEMO_TENANT_ID,
} from '../src/common/constants';

function loadDotEnv(): void {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) {
    return;
  }
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const host = process.env.WEAVIATE_HTTP_HOST ?? 'localhost';
  const port = Number(process.env.WEAVIATE_HTTP_PORT ?? 8080);
  const grpcPort = Number(process.env.WEAVIATE_GRPC_PORT ?? 50051);
  const tenantId = process.env.WEAVIATE_TENANT_ID ?? DEMO_TENANT_ID;
  const limit = Math.min(
    Number(process.env.WEAVIATE_FETCH_LIMIT ?? 10_000),
    10_000,
  );

  process.stderr.write(
    `Connecting to Weaviate http://${host}:${port} (gRPC ${grpcPort}), tenant "${tenantId}", collection "${AGENT_KNOWLEDGE_COLLECTION}"...\n`,
  );

  const client = await connectToLocal({
    host,
    port,
    grpcPort,
    skipInitChecks: false,
  });

  try {
    const coll = client.collections
      .use(AGENT_KNOWLEDGE_COLLECTION)
      .withTenant(tenantId);

    const result = await coll.query.fetchObjects({
      limit,
    });

    const objects = result.objects ?? [];
    process.stderr.write(
      `Fetched ${objects.length} object(s) (limit=${limit}).\n\n`,
    );

    const payload = {
      tenantId,
      collection: AGENT_KNOWLEDGE_COLLECTION,
      count: objects.length,
      objects: objects.map((o) => ({
        uuid: o.uuid,
        properties: o.properties,
        vector: o.vectors,
      })),
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

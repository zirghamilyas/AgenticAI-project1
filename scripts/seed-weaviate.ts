import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DEMO_TENANT_ID } from '../src/common/constants';
import { SeedService } from '../src/db/weaviate/seed.service';
import { WeaviateService } from '../src/db/weaviate/weaviate.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const weaviate = app.get(WeaviateService);
  const seed = app.get(SeedService);
  const coll = weaviate.getKnowledgeCollectionForTenant(DEMO_TENANT_ID);
  const existing = await coll.query.fetchObjects({ limit: 1 });
  if (existing.objects.length > 0) {
    console.log('Tenant already has objects; skipping seed.');
    await app.close();
    return;
  }
  await seed.seedDemoTenant();
  await app.close();
  console.log('Seed complete.');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

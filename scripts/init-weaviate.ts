import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SchemaService } from '../src/db/weaviate/schema.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const schema = app.get(SchemaService);
  await schema.ensureSchemaAndDemoTenant();
  await app.close();
  console.log('Schema + tenant ready.');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

import { Global, Module } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { SeedService } from './seed.service';
import { WeaviateService } from './weaviate.service';

/**
 * Global module: exports `WeaviateService`, `SchemaService`, `SeedService` app-wide.
 */
@Global()
@Module({
  providers: [WeaviateService, SchemaService, SeedService],
  exports: [WeaviateService, SchemaService, SeedService],
})
export class WeaviateModule {}

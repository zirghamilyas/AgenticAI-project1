import { Injectable, Logger } from '@nestjs/common';
import weaviate from 'weaviate-client';
import { AGENT_KNOWLEDGE_COLLECTION, DEMO_TENANT_ID } from '../../common/constants';
import { WeaviateService } from './weaviate.service';

/**
 * Creates `AgentKnowledge` (multi-tenant, `vectors.none()`) and ensures demo tenant exists.
 */
@Injectable()
export class SchemaService {
  private readonly logger = new Logger(SchemaService.name);

  constructor(private readonly weaviate: WeaviateService) {}

  /** Idempotent: creates collection + `tenant-demo` if missing (used by `npm run db:init`). */
  async ensureSchemaAndDemoTenant(): Promise<void> {
    const client = this.weaviate.getClient();
    const exists = await client.collections.exists(AGENT_KNOWLEDGE_COLLECTION);
    if (!exists) {
      this.logger.log(`Creating collection ${AGENT_KNOWLEDGE_COLLECTION}`);
      await client.collections.create({
        name: AGENT_KNOWLEDGE_COLLECTION,
        multiTenancy: weaviate.configure.multiTenancy({ enabled: true }),
        vectorizers: weaviate.configure.vectors.none(),
        properties: [
          {
            name: 'fileId',
            dataType: weaviate.configure.dataType.TEXT,
            skipVectorization: true,
            indexSearchable: false,
            indexFilterable: false,
          },
          {
            name: 'question',
            dataType: weaviate.configure.dataType.TEXT,
          },
          {
            name: 'answer',
            dataType: weaviate.configure.dataType.TEXT,
          },
          {
            name: 'pageNumber',
            dataType: weaviate.configure.dataType.TEXT_ARRAY,
          },
        ],
      });
    }
    const base = client.collections.use(AGENT_KNOWLEDGE_COLLECTION);
    const existing = await base.tenants.get();
    const names = new Set(Object.keys(existing));
    if (!names.has(DEMO_TENANT_ID)) {
      this.logger.log(`Creating tenant ${DEMO_TENANT_ID}`);
      await base.tenants.create([{ name: DEMO_TENANT_ID }]);
    }
  }
}

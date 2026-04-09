import { Injectable, Logger } from '@nestjs/common';
import { DEMO_TENANT_ID } from '../../common/constants';
import { WeaviateService } from './weaviate.service';

/** One row of demo content aligned with schema properties. */
type SeedRow = {
  fileId: string;
  question: string;
  answer: string;
  pageNumber: string[];
};

const SEED_ROWS: SeedRow[] = [
  {
    fileId: 'manual-alpha',
    question: 'What is the maximum operating temperature?',
    answer:
      'The device may operate up to 85C under load. Field tests showed throughput of 120 units per hour at 72C.',
    pageNumber: ['12', '13'],
  },
  {
    fileId: 'manual-beta',
    question: 'How do you reset the controller?',
    answer:
      'Hold the reset pin for 10 seconds until the status LED blinks twice, then release.',
    pageNumber: ['4'],
  },
  {
    fileId: 'policy-gamma',
    question: 'Who approves overtime?',
    answer:
      'Shift leads approve up to 8 hours; plant manager approval is required beyond that threshold.',
    pageNumber: ['7', '8'],
  },
];

/**
 * Inserts `SEED_ROWS` into `tenant-demo` via tenant-scoped `data.insert` (used by `npm run db:seed`).
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly weaviate: WeaviateService) {}

  /** Writes all seed objects; callers (CLI script) may skip if tenant already has data. */
  async seedDemoTenant(): Promise<void> {
    const coll = this.weaviate.getKnowledgeCollectionForTenant(DEMO_TENANT_ID);
    for (const row of SEED_ROWS) {
      await coll.data.insert({
        properties: {
          fileId: row.fileId,
          question: row.question,
          answer: row.answer,
          pageNumber: row.pageNumber,
        },
      });
      this.logger.log(`Seeded object for fileId=${row.fileId}`);
    }
  }
}

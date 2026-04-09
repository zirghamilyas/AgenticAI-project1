import { Injectable, Logger } from '@nestjs/common';
import type { RagReferenceData, WeaviateKnowledgeRecord } from '../../types/agent.types';
import { WeaviateService } from '../../db/weaviate/weaviate.service';
import { buildRagReferences, inlineCitationForSource } from './references';
import { rankKnowledgeRecords } from './ranking';

/**
 * RAG sub-agent: loads tenant objects from Weaviate, ranks locally, builds references + LLM context
 * for the delegating graph (`retrieveAndPrepare`).
 */
@Injectable()
export class RagAgentService {
  private readonly logger = new Logger(RagAgentService.name);

  constructor(private readonly weaviate: WeaviateService) {}

  /**
   * Loads up to 500 objects via `fetchObjects`, ranks by `scoreRecordForQuery`, takes top `topK`.
   * If no keyword hits, uses a small fallback slice so demos still return something.
   */
  async retrieveAndPrepare(
    tenantId: string,
    query: string,
    topK: number,
  ): Promise<{
    references: RagReferenceData[];
    contextBlock: string;
    recordsUsed: WeaviateKnowledgeRecord[];
  }> {
    const coll = this.weaviate.getKnowledgeCollectionForTenant(tenantId);
    const fetched = await coll.query.fetchObjects({
      limit: 500,
    });
    const records: WeaviateKnowledgeRecord[] = (fetched.objects ?? []).map(
      (o) => {
        const p = o.properties as {
          fileId?: string;
          question?: string;
          answer?: string;
          pageNumber?: string[];
        };
        return {
          uuid: o.uuid,
          fileId: p.fileId ?? '',
          question: p.question ?? '',
          answer: p.answer ?? '',
          pageNumber: p.pageNumber ?? [],
        };
      },
    );
    const ranked = rankKnowledgeRecords(query, records);
    const used = ranked.slice(0, topK);
    if (used.length === 0) {
      this.logger.warn(
        'Keyword ranking returned no matches; falling back to first objects for demo continuity.',
      );
      const fallback = records.slice(0, Math.min(2, records.length));
      const references = buildRagReferences(fallback);
      return {
        references,
        contextBlock: this.buildContextBlock(fallback, references),
        recordsUsed: fallback,
      };
    }
    const references = buildRagReferences(used);
    return {
      references,
      contextBlock: this.buildContextBlock(used, references),
      recordsUsed: used,
    };
  }

  /** Concatenates Q/A snippets with citation tags for the synthesis prompt. */
  private buildContextBlock(
    used: WeaviateKnowledgeRecord[],
    references: RagReferenceData[],
  ): string {
    const citeByFile = new Map(
      references.map((r) => [r.fileId, r] as const),
    );
    const lines: string[] = [];
    for (const rec of used) {
      const ref = citeByFile.get(rec.fileId);
      const cite = ref
        ? inlineCitationForSource(ref.sourceNumber, ref.pageNumbers)
        : '';
      lines.push(
        `Source fragment (${cite}):\nQ: ${rec.question}\nA: ${rec.answer}`,
      );
    }
    return lines.join('\n\n');
  }
}

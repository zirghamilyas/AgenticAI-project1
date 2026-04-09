import { Injectable } from '@nestjs/common';
import { ChartToolService } from '../../tools/chart/chart.tool';
import { RagAgentService } from '../rag/rag.agent';
import {
  buildDelegatingGraph,
  type DelegatingGraphState,
} from './delegating.graph';

/**
 * Nest wrapper around the compiled LangGraph: one `invoke` per user message for `ChatService`.
 */
@Injectable()
export class DelegatingAgentService {
  /** Compiled LangGraph instance (built once in constructor). */
  private readonly graph;

  constructor(
    private readonly ragAgent: RagAgentService,
    private readonly chartTool: ChartToolService,
  ) {
    this.graph = buildDelegatingGraph({
      ragAgent: this.ragAgent,
      chartTool: this.chartTool,
    });
  }

  /** Runs the full graph: returns `data`, `streamingPrompt`, and related state fields. */
  async run(
    query: string,
    tenantId: string,
  ): Promise<DelegatingGraphState> {
    return this.graph.invoke({
      query,
      tenantId,
      intent: undefined,
      data: [],
      ragContextBlock: undefined,
      streamingPrompt: undefined,
    });
  }
}

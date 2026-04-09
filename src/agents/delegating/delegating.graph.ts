import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { AgentData, AgentIntent } from '../../types/agent.types';
import type { RagAgentService } from '../rag/rag.agent';
import type { ChartToolService } from '../../tools/chart/chart.tool';
import { classifyIntent as classifyUserIntent } from './routing';

/**
 * LangGraph pipeline: `classifyIntent` → `executeTools` (RAG/chart) → `preparePrompt` (LLM instructions).
 * Invoked once per chat before `ChatService` streams tokens.
 */
export type DelegatingGraphDeps = {
  ragAgent: RagAgentService;
  chartTool: ChartToolService;
};

const GraphState = Annotation.Root({
  query: Annotation<string>(),
  tenantId: Annotation<string>(),
  intent: Annotation<AgentIntent | undefined>(),
  data: Annotation<AgentData[]>(),
  ragContextBlock: Annotation<string | undefined>(),
  streamingPrompt: Annotation<string | undefined>(),
});

export type DelegatingGraphState = typeof GraphState.State;

/** Wires graph nodes with injected RAG and chart services; returns a compiled graph. */
export function buildDelegatingGraph(deps: DelegatingGraphDeps) {
  /** Sets `intent` from `routing.classifyIntent` (no side effects). */
  const classifyIntentNode = async (
    state: DelegatingGraphState,
  ): Promise<Partial<DelegatingGraphState>> => ({
    intent: classifyUserIntent(state.query),
  });

  /** Populates `data` (RAG refs / chart) and `ragContextBlock` when RAG runs. */
  const executeToolsNode = async (
    state: DelegatingGraphState,
  ): Promise<Partial<DelegatingGraphState>> => {
    const intent = state.intent;
    if (!intent) {
      return { data: [], ragContextBlock: undefined };
    }
    switch (intent) {
      case 'direct':
        return { data: [], ragContextBlock: undefined };
      case 'rag': {
        const r = await deps.ragAgent.retrieveAndPrepare(
          state.tenantId,
          state.query,
          4,
        );
        return { data: [...r.references], ragContextBlock: r.contextBlock };
      }
      case 'chart':
        return {
          data: [deps.chartTool.buildMockChart()],
          ragContextBlock: undefined,
        };
      case 'rag_chart_parallel': {
        const [r, chart] = await Promise.all([
          deps.ragAgent.retrieveAndPrepare(state.tenantId, state.query, 4),
          Promise.resolve(deps.chartTool.buildMockChart()),
        ]);
        return {
          data: [...r.references, chart],
          ragContextBlock: r.contextBlock,
        };
      }
      case 'rag_chart_sequential': {
        const r = await deps.ragAgent.retrieveAndPrepare(
          state.tenantId,
          state.query,
          4,
        );
        const chart = deps.chartTool.buildMockChart();
        return {
          data: [...r.references, chart],
          ragContextBlock: r.contextBlock,
        };
      }
      default:
        return { data: [], ragContextBlock: undefined };
    }
  };

  /** Builds the final LLM instruction string; streamed later by `ChatService` (not by the graph). */
  const preparePromptNode = async (
    state: DelegatingGraphState,
  ): Promise<Partial<DelegatingGraphState>> => {
    const intent = state.intent ?? 'direct';
    const q = state.query;
    const ctx = state.ragContextBlock;
    switch (intent) {
      case 'direct':
        return {
          streamingPrompt: [
            'You are a helpful assistant.',
            'Answer clearly and briefly.',
            `User: ${q}`,
          ].join('\n\n'),
        };
      case 'rag':
        return {
          streamingPrompt: [
            'You answer using ONLY the provided context.',
            'Include human-readable inline citations using the exact numbering from the context, e.g. "1- Page 12" or "2- Pages 7, 8".',
            'If context is insufficient, say so explicitly.',
            '',
            'Context:',
            ctx ?? '(empty)',
            '',
            `Question: ${q}`,
          ].join('\n'),
        };
      case 'chart':
        return {
          streamingPrompt: [
            'The client already received a Chart.js configuration JSON in the separate structured data channel.',
            'Respond with a short explanation of what the mock chart represents (it is not rendered server-side).',
            `User request: ${q}`,
          ].join('\n\n'),
        };
      case 'rag_chart_parallel':
      case 'rag_chart_sequential':
        return {
          streamingPrompt: [
            'You have both retrieved knowledge (with references in structured data) and a mock Chart.js config in structured data.',
            'Answer using the retrieved context with proper inline citations like "1- Page 12".',
            'Mention that the chart is a mocked visualization and not computed from live plotting.',
            '',
            'Context:',
            ctx ?? '(empty)',
            '',
            `User: ${q}`,
          ].join('\n'),
        };
      default:
        return {
          streamingPrompt: `User: ${q}`,
        };
    }
  };

  return new StateGraph(GraphState)
    .addNode('classifyIntent', classifyIntentNode)
    .addNode('executeTools', executeToolsNode)
    .addNode('preparePrompt', preparePromptNode)
    .addEdge(START, 'classifyIntent')
    .addEdge('classifyIntent', 'executeTools')
    .addEdge('executeTools', 'preparePrompt')
    .addEdge('preparePrompt', END)
    .compile();
}

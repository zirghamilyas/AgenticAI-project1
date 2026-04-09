/**
 * Shared types for the delegating agent, streamed chat payloads, and knowledge rows.
 * `AgentData` is a discriminated union (`type`: `rag_reference` | `chartjs`).
 */

/** Route chosen by `routing.classifyIntent` before tools and prompt preparation run. */
export type AgentIntent =
  | 'direct'
  | 'rag'
  | 'chart'
  | 'rag_chart_parallel'
  | 'rag_chart_sequential';

export type RagReferenceData = {
  type: 'rag_reference';
  sourceNumber: number;
  fileId: string;
  pageNumbers: string[];
  citationLabel: string;
  question: string;
  answer: string;
};

export type ChartJsData = {
  type: 'chartjs';
  chartId: string;
  config: Record<string, unknown>;
};

export type AgentData = RagReferenceData | ChartJsData;

export type StreamPayload = {
  answer: string;
  data: AgentData[];
};

export type WeaviateKnowledgeRecord = {
  uuid: string;
  fileId: string;
  question: string;
  answer: string;
  pageNumber: string[];
};

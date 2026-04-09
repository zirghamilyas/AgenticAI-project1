import type { AgentIntent } from '../../types/agent.types';

/**
 * Deterministic intent detection (regex/keywords). LLM is not used for routing here.
 */
const GREETING_RE =
  /^(hi|hello|hey|good\s+(morning|afternoon|evening)|how\s+are\s+you)\b/i;
const META_RE =
  /\b(who are you|what are you|help\b|capabilities|what can you do)\b/i;

const CHART_RE =
  /\b(chart|graph|plot|bar chart|line chart|visualize|visualization)\b/i;
const RAG_RE =
  /\b(documents?|manual|policy|knowledge|source|page|according to|from the (docs|documents|manual|database)|retrieve|lookup)\b/i;

/** If true, chart numbers should come from retrieved text (RAG first, then chart). */
export function chartDependsOnRetrieval(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(from|using|based on)\s+(the\s+)?(docs|documents|manual|knowledge|records|database)\b/.test(
      q,
    ) || /\bplot\s+(the|those)\s+(numbers|values|figures)\b/.test(q)
  );
}

/**
 * Picks one `AgentIntent`: direct Q&A, RAG, chart, or combined parallel/sequential.
 * Sequential is used when the user ties the chart to document-derived numbers.
 */
export function classifyIntent(query: string): AgentIntent {
  const q = query.trim();
  if (q.length === 0) {
    return 'direct';
  }
  if (GREETING_RE.test(q) || META_RE.test(q)) {
    return 'direct';
  }
  const wantsChart = CHART_RE.test(q);
  const wantsRag = RAG_RE.test(q);
  if (wantsChart && wantsRag) {
    return chartDependsOnRetrieval(q)
      ? 'rag_chart_sequential'
      : 'rag_chart_parallel';
  }
  if (wantsChart) {
    return 'chart';
  }
  if (wantsRag) {
    return 'rag';
  }
  if (q.length < 48 && !/[?]/.test(q)) {
    return 'direct';
  }
  return 'rag';
}

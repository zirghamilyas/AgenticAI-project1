import type { WeaviateKnowledgeRecord } from '../../types/agent.types';

/**
 * Fallback retrieval ranking: simple overlap scoring over question+answer text only.
 * Used when the collection has no vector search path in this app (`vectors.none()`).
 */

/** Normalizes text to lowercase word tokens for overlap scoring. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Explicit keyword overlap ranking over question + answer only (never fileId).
 * This is not semantic/vector retrieval.
 */
export function scoreRecordForQuery(
  query: string,
  record: Pick<WeaviateKnowledgeRecord, 'question' | 'answer'>,
): number {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) {
    return 0;
  }
  const hay = `${record.question}\n${record.answer}`.toLowerCase();
  const qPhrase = query.toLowerCase().trim();
  let score = 0;
  if (qPhrase.length > 2 && hay.includes(qPhrase)) {
    score += 12;
  }
  for (const t of qTokens) {
    if (t.length < 2) {
      continue;
    }
    const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'gi');
    const matches = hay.match(re);
    if (matches) {
      score += 2 + matches.length;
    }
  }
  return score;
}

/** Escapes user/query tokens before embedding them in RegExp (word-boundary matches). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Drops records with score 0, sorts by descending score. Caller typically slices top-K.
 */
export function rankKnowledgeRecords(
  query: string,
  records: WeaviateKnowledgeRecord[],
): WeaviateKnowledgeRecord[] {
  return [...records]
    .map((r) => ({
      r,
      s: scoreRecordForQuery(query, { question: r.question, answer: r.answer }),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

import type { RagReferenceData, WeaviateKnowledgeRecord } from '../../types/agent.types';

/**
 * Builds grouped RAG reference objects and printable citation strings for the LLM and UI.
 */

/** Human-readable page label: "Page 3" or "Pages 3, 4" after dedupe + sort. */
export function formatPageCitationLabel(pageNumbers: string[]): string {
  const pages = [...new Set(pageNumbers)].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na - nb;
    }
    return a.localeCompare(b);
  });
  if (pages.length === 0) {
    return 'Page ?';
  }
  if (pages.length === 1) {
    return `Page ${pages[0]}`;
  }
  return `Pages ${pages.join(', ')}`;
}

/**
 * Group by fileId, merge page lists, assign sourceNumber by first-seen file order.
 */
export function buildRagReferences(
  orderedRecords: WeaviateKnowledgeRecord[],
): RagReferenceData[] {
  const byFile = new Map<
    string,
    { question: string; answer: string; pages: Set<string> }
  >();
  const fileOrder: string[] = [];
  for (const rec of orderedRecords) {
    if (!byFile.has(rec.fileId)) {
      byFile.set(rec.fileId, {
        question: rec.question,
        answer: rec.answer,
        pages: new Set(),
      });
      fileOrder.push(rec.fileId);
    }
    const g = byFile.get(rec.fileId)!;
    for (const p of rec.pageNumber) {
      g.pages.add(p);
    }
  }
  return fileOrder.map((fileId, idx) => {
    const g = byFile.get(fileId)!;
    const pageNumbers = [...g.pages].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return na - nb;
      }
      return a.localeCompare(b);
    });
    const citationLabel = formatPageCitationLabel(pageNumbers);
    return {
      type: 'rag_reference' as const,
      sourceNumber: idx + 1,
      fileId,
      pageNumbers,
      citationLabel,
      question: g.question,
      answer: g.answer,
    };
  });
}

/**
 * Inline citation line for prompts, e.g. `1- Page 12` (matches assessment citation format).
 */
export function inlineCitationForSource(
  sourceNumber: number,
  pageNumbers: string[],
): string {
  const pages = [...new Set(pageNumbers)].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na - nb;
    }
    return a.localeCompare(b);
  });
  if (pages.length === 0) {
    return `${sourceNumber}- Page ?`;
  }
  if (pages.length === 1) {
    return `${sourceNumber}- Page ${pages[0]}`;
  }
  return `${sourceNumber}- Pages ${pages.join(', ')}`;
}

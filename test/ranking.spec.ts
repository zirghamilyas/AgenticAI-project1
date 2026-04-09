import {
  rankKnowledgeRecords,
  scoreRecordForQuery,
  tokenize,
} from '../src/agents/rag/ranking';
import type { WeaviateKnowledgeRecord } from '../src/types/agent.types';

describe('fallback ranking', () => {
  it('tokenizes lowercased words', () => {
    expect(tokenize('Hello, WORLD!')).toEqual(['hello', 'world']);
  });

  it('scores phrase and token overlap', () => {
    const s = scoreRecordForQuery('reset controller', {
      question: 'How reset?',
      answer: 'Hold reset for 10 seconds on the controller board.',
    });
    expect(s).toBeGreaterThan(0);
  });

  it('never uses fileId text in scoring', () => {
    const rec: WeaviateKnowledgeRecord = {
      uuid: 'u',
      fileId: 'secret-file-id-token',
      question: 'unrelated',
      answer: 'unrelated',
      pageNumber: [],
    };
    const s = scoreRecordForQuery('secret-file-id-token', rec);
    expect(s).toBe(0);
  });

  it('ranks higher scores first', () => {
    const rows: WeaviateKnowledgeRecord[] = [
      {
        uuid: '1',
        fileId: 'a',
        question: 'cats',
        answer: 'dogs',
        pageNumber: [],
      },
      {
        uuid: '2',
        fileId: 'b',
        question: 'alpha beta gamma',
        answer: 'alpha beta gamma delta',
        pageNumber: [],
      },
    ];
    const ranked = rankKnowledgeRecords('alpha beta', rows);
    expect(ranked[0].uuid).toBe('2');
  });
});

import {
  buildRagReferences,
  formatPageCitationLabel,
  inlineCitationForSource,
} from '../src/agents/rag/references';

describe('references', () => {
  it('formats single and multi page labels', () => {
    expect(formatPageCitationLabel(['3'])).toBe('Page 3');
    expect(formatPageCitationLabel(['4', '3'])).toBe('Pages 3, 4');
  });

  it('groups by fileId and assigns source numbers', () => {
    const refs = buildRagReferences([
      {
        uuid: 'a',
        fileId: 'f1',
        question: 'q1',
        answer: 'a1',
        pageNumber: ['1'],
      },
      {
        uuid: 'b',
        fileId: 'f2',
        question: 'q2',
        answer: 'a2',
        pageNumber: ['7'],
      },
      {
        uuid: 'c',
        fileId: 'f1',
        question: 'q1b',
        answer: 'a1b',
        pageNumber: ['2'],
      },
    ]);
    expect(refs).toHaveLength(2);
    expect(refs[0].sourceNumber).toBe(1);
    expect(refs[0].fileId).toBe('f1');
    expect(refs[0].pageNumbers).toEqual(['1', '2']);
    expect(refs[1].sourceNumber).toBe(2);
  });

  it('formats inline citations', () => {
    expect(inlineCitationForSource(1, ['3'])).toBe('1- Page 3');
    expect(inlineCitationForSource(2, ['7', '8'])).toBe('2- Pages 7, 8');
  });
});

import {
  chartDependsOnRetrieval,
  classifyIntent,
} from '../src/agents/delegating/routing';

describe('routing', () => {
  it('classifies greetings as direct', () => {
    expect(classifyIntent('Hello there')).toBe('direct');
  });

  it('classifies chart-only', () => {
    expect(classifyIntent('Make a bar chart of sales')).toBe('chart');
  });

  it('classifies rag-only', () => {
    expect(
      classifyIntent('What does the manual say about reset?'),
    ).toBe('rag');
  });

  it('parallel rag+chart when independent', () => {
    expect(
      classifyIntent('Show a chart and summarize the knowledge base'),
    ).toBe('rag_chart_parallel');
  });

  it('sequential when chart should use retrieved content', () => {
    expect(
      classifyIntent('Plot the numbers from the documents as a chart'),
    ).toBe('rag_chart_sequential');
  });

  it('chartDependsOnRetrieval detects doc-grounded chart', () => {
    expect(chartDependsOnRetrieval('chart using the manual numbers')).toBe(
      true,
    );
    expect(chartDependsOnRetrieval('make a chart')).toBe(false);
  });
});

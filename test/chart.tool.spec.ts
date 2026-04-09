import { ChartToolService } from '../src/tools/chart/chart.tool';

describe('ChartToolService', () => {
  it('returns discriminated chartjs payload', () => {
    const svc = new ChartToolService();
    const c = svc.buildMockChart();
    expect(c.type).toBe('chartjs');
    expect(typeof c.chartId).toBe('string');
    expect(c.config).toMatchObject({ type: 'bar' });
    expect((c.config as { data: unknown }).data).toBeDefined();
  });
});

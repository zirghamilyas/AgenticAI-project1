import { Injectable } from '@nestjs/common';
import type { ChartJsData } from '../../types/agent.types';

/** Fixed bar chart JSON — assessment allows a static mock; no server-side rendering. */
const MOCK_BAR: Record<string, unknown> = {
  type: 'bar',
  data: {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Series A (mock)',
        data: [12, 19, 3, 5],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
    ],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: true },
      title: {
        display: true,
        text: 'Mock Chart.js config (server does not render)',
      },
    },
  },
};

/**
 * Delegating graph calls this for `chart` / combined intents; output is JSON only.
 */
@Injectable()
export class ChartToolService {
  /** Returns a valid `chartjs` discriminant payload for the chat `data` array. */
  buildMockChart(): ChartJsData {
    return {
      type: 'chartjs',
      chartId: `chart-${Date.now()}`,
      config: MOCK_BAR,
    };
  }
}

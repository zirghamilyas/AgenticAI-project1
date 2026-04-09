import { Injectable } from '@nestjs/common';
import type { LlmProvider } from './llm-provider.interface';

/**
 * Deterministic LLM stand-in for tests and `LLM_PROVIDER=mock` — no network I/O.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  async *streamAnswer(prompt: string): AsyncGenerator<string, void, unknown> {
    const text = await this.invokeAnswer(prompt);
    const parts = text.split(/(\s+)/);
    for (const p of parts) {
      yield p;
    }
  }

  async invokeAnswer(prompt: string): Promise<string> {
    return (
      `[mock-llm] No external model call was made. Prompt preview: ${prompt
        .replace(/\s+/g, ' ')
        .slice(0, 280)}`
    );
  }
}

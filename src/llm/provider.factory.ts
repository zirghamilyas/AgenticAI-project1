import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderKind } from '../common/config/env.validation';
import { GeminiLlmProvider } from './gemini.provider';
import { LLM_PROVIDER } from './llm-provider.interface';
import { MockLlmProvider } from './mock.provider';

/** Selects `MockLlmProvider` vs `GeminiLlmProvider` from `LLM_PROVIDER` env at runtime. */
export const llmProviderBinding: Provider = {
  provide: LLM_PROVIDER,
  useFactory: (config: ConfigService, gemini: GeminiLlmProvider, mock: MockLlmProvider) => {
    const kind = config.get<LlmProviderKind>('LLM_PROVIDER', LlmProviderKind.GEMINI);
    if (kind === LlmProviderKind.MOCK) {
      return mock;
    }
    return gemini;
  },
  inject: [ConfigService, GeminiLlmProvider, MockLlmProvider],
};

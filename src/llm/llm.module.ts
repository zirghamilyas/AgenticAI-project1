import { Module } from '@nestjs/common';
import { GeminiLlmProvider } from './gemini.provider';
import { llmProviderBinding } from './provider.factory';
import { MockLlmProvider } from './mock.provider';

/**
 * Registers Gemini + mock implementations and exports the `LLM_PROVIDER` binding.
 */
@Module({
  providers: [GeminiLlmProvider, MockLlmProvider, llmProviderBinding],
  exports: [llmProviderBinding],
})
export class LlmModule {}

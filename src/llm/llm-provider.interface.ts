/**
 * Pluggable LLM surface for `ChatService` (Gemini, mock, or future providers via `LLM_PROVIDER`).
 */
export interface LlmProvider {
  /** Stream plain text deltas (may be word-sized in mock mode). */
  streamAnswer(prompt: string): AsyncGenerator<string, void, unknown>;
  invokeAnswer(prompt: string): Promise<string>;
}

/** Injection token resolved by `provider.factory` to the active `LlmProvider` implementation. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

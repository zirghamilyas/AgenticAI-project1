import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { LlmProvider } from './llm-provider.interface';

/**
 * LangChain `ChatGoogleGenerativeAI`: streams or invokes; falls back to `MockFallback` without key/on error.
 */
@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiLlmProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** Returns `null` when `GOOGLE_API_KEY` is unset so callers use offline fallback. */
  private getModel(): ChatGoogleGenerativeAI | null {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      return null;
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
    return new ChatGoogleGenerativeAI({
      apiKey,
      model,
    });
  }

  /** Yields token/text chunks from Gemini; normalizes multimodal `content` arrays when present. */
  async *streamAnswer(
    prompt: string,
  ): AsyncGenerator<string, void, unknown> {
    const chat = this.getModel();
    if (!chat) {
      const txt = await new MockFallback().invokeAnswer(prompt);
      for (const part of txt.split(/(\s+)/)) {
        yield part;
      }
      return;
    }
    try {
      const stream = await chat.stream([new HumanMessage(prompt)]);
      for await (const chunk of stream) {
        const c = chunk.content;
        if (typeof c === 'string' && c.length > 0) {
          yield c;
        } else if (Array.isArray(c)) {
          const text = c
            .filter(
              (p): p is { type: 'text'; text: string } =>
                typeof p === 'object' &&
                p !== null &&
                'type' in p &&
                (p as { type: string }).type === 'text',
            )
            .map((p) => p.text)
            .join('');
          if (text) {
            yield text;
          }
        }
      }
    } catch (e) {
      this.logger.warn(
        `Gemini stream failed; using deterministic fallback. ${String(e)}`,
      );
      const txt = await new MockFallback().invokeAnswer(prompt);
      for (const part of txt.split(/(\s+)/)) {
        yield part;
      }
    }
  }

  async invokeAnswer(prompt: string): Promise<string> {
    const chat = this.getModel();
    if (!chat) {
      return new MockFallback().invokeAnswer(prompt);
    }
    try {
      const res = await chat.invoke([new HumanMessage(prompt)]);
      const c = res.content;
      if (typeof c === 'string') {
        return c;
      }
      if (Array.isArray(c)) {
        return c
          .map((x) =>
            typeof x === 'object' && x && 'text' in x
              ? String((x as { text: string }).text)
              : '',
          )
          .join('');
      }
      return String(c);
    } catch (e) {
      this.logger.warn(
        `Gemini invoke failed; using deterministic fallback. ${String(e)}`,
      );
      return new MockFallback().invokeAnswer(prompt);
    }
  }
}

/** Inline minimal fallback to avoid circular DI. */
class MockFallback {
  async invokeAnswer(prompt: string): Promise<string> {
    return `[offline-llm] Set GOOGLE_API_KEY to enable Gemini. Prompt preview: ${prompt
      .replace(/\s+/g, ' ')
      .slice(0, 240)}`;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { StreamPayload } from '../types/agent.types';
import { DelegatingAgentService } from '../agents/delegating/delegating-agent.service';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from '../llm/llm-provider.interface';
import type { ChatDto } from './dto/chat.dto';

/**
 * Chat orchestration: runs delegating graph (non-streaming), then streams LLM tokens as SSE payloads.
 * Yields `{ answer, data }` — first chunk exposes `data` (refs/chart); later chunks grow `answer`.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly delegatingAgent: DelegatingAgentService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  /**
   * Async generator consumed by `ChatController` for SSE: each yield is one `data:` JSON line.
   */
  async *streamChat(dto: ChatDto): AsyncGenerator<StreamPayload> {
    const state = await this.delegatingAgent.run(dto.query, dto.tenantId);
    const data = state.data ?? [];
    const prompt = state.streamingPrompt ?? dto.query;
    yield { answer: '', data };
    let acc = '';
    for await (const part of this.llm.streamAnswer(prompt)) {
      acc += part;
      yield { answer: acc, data };
    }
  }
}

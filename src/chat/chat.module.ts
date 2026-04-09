import { Module } from '@nestjs/common';
import { DelegatingAgentService } from '../agents/delegating/delegating-agent.service';
import { RagAgentService } from '../agents/rag/rag.agent';
import { ChartToolService } from '../tools/chart/chart.tool';
import { LlmModule } from '../llm/llm.module';
import { WeaviateModule } from '../db/weaviate/weaviate.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/**
 * Chat feature module: controller, streaming service, delegating agent, RAG, chart tool.
 */
@Module({
  imports: [WeaviateModule, LlmModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    RagAgentService,
    ChartToolService,
    DelegatingAgentService,
  ],
})
export class ChatModule {}

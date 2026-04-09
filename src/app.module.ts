import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './common/config/env.validation';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
import { WeaviateModule } from './db/weaviate/weaviate.module';

/** Root module: global config, Weaviate (global), LLM, health, chat. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    WeaviateModule,
    LlmModule,
    HealthModule,
    ChatModule,
  ],
})
export class AppModule {}

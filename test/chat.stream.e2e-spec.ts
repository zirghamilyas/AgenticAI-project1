import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER } from '../src/llm/llm-provider.interface';
import type { LlmProvider } from '../src/llm/llm-provider.interface';
import { WeaviateService } from '../src/db/weaviate/weaviate.service';

class StreamingMockLlm implements LlmProvider {
  async *streamAnswer(): AsyncGenerator<string, void, unknown> {
    yield 'Hello ';
    yield 'world';
  }
  async invokeAnswer(): Promise<string> {
    return 'Hello world';
  }
}

const mockWeaviate = {
  onModuleInit: async () => undefined,
  getClient: () => {
    throw new Error('not used in this e2e path');
  },
  getKnowledgeCollectionForTenant: () => ({
    query: {
      fetchObjects: async () => ({ objects: [] as { uuid: string; properties: object }[] }),
    },
  }),
};

describe('Chat streaming (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WeaviateService)
      .useValue(mockWeaviate)
      .overrideProvider(LLM_PROVIDER)
      .useValue(new StreamingMockLlm())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 when tenantId missing', () => {
    return request(app.getHttpServer())
      .post('/api/chat')
      .send({ query: 'hi' })
      .expect(400);
  });

  it('streams SSE JSON payloads', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/chat')
      .send({ query: 'Hello', tenantId: 'tenant-demo' });

    expect(res.status).toBe(200);
    const text = res.text;
    expect(text).toContain('data: ');
    const lines = text
      .split('\n')
      .filter((l: string) => l.startsWith('data: '))
      .map((l: string) => l.replace(/^data:\s*/, ''));
    expect(lines.length).toBeGreaterThan(0);
    const last = JSON.parse(lines[lines.length - 1]!);
    expect(last.answer).toContain('Hello');
    expect(Array.isArray(last.data)).toBe(true);
  });
});

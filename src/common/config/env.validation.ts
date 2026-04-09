import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Loads and validates env for `ConfigModule.forRoot({ validate })`.
 * Coerces string env vars (e.g. PORT) to numbers for `ConfigService.get<number>`.
 */

/** Which LLM implementation `llmProviderBinding` wires for `LLM_PROVIDER`. */
export enum LlmProviderKind {
  GEMINI = 'gemini',
  MOCK = 'mock',
}

/** Fields map 1:1 to `.env` keys; defaults apply when a variable is omitted. */
export class EnvironmentVariables {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsOptional()
  @IsString()
  NODE_ENV = 'development';

  @IsOptional()
  @IsString()
  WEAVIATE_HTTP_HOST = 'localhost';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  WEAVIATE_HTTP_PORT = 8080;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  WEAVIATE_GRPC_PORT = 50051;

  @IsOptional()
  @IsString()
  GOOGLE_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_MODEL = 'gemini-2.0-flash';

  @IsOptional()
  @IsEnum(LlmProviderKind)
  LLM_PROVIDER: LlmProviderKind = LlmProviderKind.GEMINI;
}

/** Parses `config` (from dotenv) into `EnvironmentVariables` or throws with validation errors. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const coerced = {
    ...config,
    PORT: config.PORT !== undefined ? Number(config.PORT) : 3000,
    WEAVIATE_HTTP_PORT:
      config.WEAVIATE_HTTP_PORT !== undefined
        ? Number(config.WEAVIATE_HTTP_PORT)
        : 8080,
    WEAVIATE_GRPC_PORT:
      config.WEAVIATE_GRPC_PORT !== undefined
        ? Number(config.WEAVIATE_GRPC_PORT)
        : 50051,
  };
  const validated = plainToInstance(EnvironmentVariables, coerced, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}

/**
 * Request body for `POST /api/chat` — validated by global `ValidationPipe`.
 */
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsString()
  @IsNotEmpty({ message: 'tenantId is required' })
  tenantId!: string;
}

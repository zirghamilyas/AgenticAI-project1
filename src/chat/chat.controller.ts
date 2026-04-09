/**
 * `POST /api/chat`: validates body, sets SSE headers, writes each `StreamPayload` as SSE `data:` lines.
 */
import {
  Body,
  Controller,
  Post,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';

/** Thin controller: no business logic; streams bytes from `ChatService.streamChat`. */
@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(
    @Body() body: ChatDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const chunk of this.chatService.streamChat(body)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (e) {
      const errPayload = {
        answer: `Error: ${e instanceof Error ? e.message : String(e)}`,
        data: [] as unknown[],
      };
      res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
    }
    res.end();
  }
}

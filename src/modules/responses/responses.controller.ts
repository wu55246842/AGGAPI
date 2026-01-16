import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ResponsesService } from './responses.service';
import { validateUnifiedRequest } from '../../core/unified-schema/validate';
import { UnifiedRequest, SSEEvent } from '../../core/unified-schema/types';
import { AuthGuard } from '../../common/auth.guard';
import { RateLimitGuard } from '../../common/rate-limit.guard';
import { JobsService } from '../jobs/jobs.service';

@Controller('v1')
export class ResponsesController {
  constructor(
    private readonly responses: ResponsesService,
    private readonly jobs: JobsService,
  ) {}

  @Post('responses')
  @UseGuards(AuthGuard, RateLimitGuard)
  async createResponse(
    @Body() body: UnifiedRequest,
    @Req() request: FastifyRequest & { requestId?: string; user?: any },
    @Res() reply: FastifyReply,
  ) {
    validateUnifiedRequest(body);
    if (request.user) {
      request.user.model = body.model;
    }
    if (body.webhook_url) {
      const job = await this.jobs.createJob(body, request.requestId ?? 'unknown');
      reply.status(202).send(job);
      return;
    }
    const response = await this.responses.generate(body, request.requestId ?? 'unknown', request.user);
    if (request.user) {
      request.user.provider = response.provider?.name;
    }
    reply.send(response);
  }

  @Post('responses/stream')
  @UseGuards(AuthGuard, RateLimitGuard)
  async streamResponse(
    @Body() body: UnifiedRequest,
    @Req() request: FastifyRequest & { requestId?: string; user?: any },
    @Res() reply: FastifyReply,
  ) {
    validateUnifiedRequest(body);
    if (request.user) {
      request.user.model = body.model;
    }
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    try {
      const stream = this.responses.stream(body, request.requestId ?? 'unknown', request.user);
      for await (const event of stream) {
        const payload: SSEEvent = event;
        if (payload.type === 'response.completed' && request.user) {
          const providerName = (payload.data as any)?.provider?.name;
          if (providerName) {
            request.user.provider = providerName;
          }
        }
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
      reply.raw.end();
    } catch (error) {
      const failed: SSEEvent = {
        type: 'response.failed',
        data: { message: (error as Error).message },
      };
      reply.raw.write(`data: ${JSON.stringify(failed)}\n\n`);
      reply.raw.end();
    }
  }

  @Post('chat.completions')
  @UseGuards(AuthGuard, RateLimitGuard)
  async chatCompletions(
    @Body() body: any,
    @Req() request: FastifyRequest & { requestId?: string; user?: any },
    @Res() reply: FastifyReply,
  ) {
    const unified: UnifiedRequest = {
      model: body.model,
      input: {
        messages: body.messages?.map((msg: any) => ({
          role: msg.role,
          content: [{ type: 'text', text: msg.content }],
        })),
      },
      generation: {
        temperature: body.temperature,
        max_output_tokens: body.max_tokens,
        top_p: body.top_p,
      },
      stream: body.stream,
    };
    if (request.user) {
      request.user.model = unified.model;
    }
    if (body.stream) {
      await this.streamResponse(unified, request, reply);
      return;
    }
    const response = await this.responses.generate(unified, request.requestId ?? 'unknown', request.user);
    if (request.user) {
      request.user.provider = response.provider?.name;
    }
    const choice = response.outputs[0]?.message?.content?.[0];
    const contentText = choice && 'text' in choice ? choice.text : '';
    reply.send({
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: body.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: contentText },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    });
  }
}

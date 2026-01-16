import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RouterService } from '../../core/router/router.service';
import { ProviderRegistry } from '../../providers/provider.registry';
import { UnifiedRequest, UnifiedResponse, SSEEvent } from '../../core/unified-schema/types';
import { PrismaService } from '../../common/prisma.service';
import { MODEL_CATALOG } from '../models/catalog';
import { calculateCostUsd } from '../usage/billing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ResponsesService {
  constructor(
    private readonly router: RouterService,
    private readonly providers: ProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}


  private async recordUsage(
    requestId: string,
    request: UnifiedRequest,
    providerName: string,
    usage: { input_tokens: number; output_tokens: number; total_tokens: number; cost_usd: number },
    auth: { apiKeyId: string; tenantId: string; projectId: string },
  ) {
    await this.prisma.usageEvent.create({
      data: {
        requestId,
        apiKeyId: auth.apiKeyId,
        tenantId: auth.tenantId,
        projectId: auth.projectId,
        provider: providerName,
        model: request.model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        costUsd: usage.cost_usd,
      },
    });

    await this.prisma.requestAudit.create({
      data: {
        requestId,
        provider: providerName,
        model: request.model,
        costUsd: usage.cost_usd,
      },
    });
  }

  private ensureCapabilities(request: UnifiedRequest, provider: string) {
    const entry = MODEL_CATALOG.find((model) => model.publicName === request.model && model.provider === provider);
    if (!entry) {
      throw new HttpException({ code: 'BAD_REQUEST', message: 'Model not found' }, HttpStatus.BAD_REQUEST);
    }
    if (request.generation?.tools?.length && !entry.capabilities.tools) {
      throw new HttpException(
        { code: 'CAPABILITY_UNSUPPORTED', message: 'Tools not supported by provider' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (request.generation?.response_format?.type === 'json_schema' && !entry.capabilities.json_schema) {
      throw new HttpException(
        { code: 'CAPABILITY_UNSUPPORTED', message: 'JSON schema not supported by provider' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async generate(
    request: UnifiedRequest,
    requestId: string,
    auth: { apiKeyId: string; tenantId: string; projectId: string },
  ): Promise<UnifiedResponse> {
    const decision = this.router.route(request);
    const candidates = [
      { provider: decision.provider, model: decision.providerModel },
      ...decision.fallback.map((fallback) => ({ provider: fallback.provider, model: fallback.providerModel })),
    ];

    let lastError: (Error & { status?: number }) | null = null;
    let lastProvider: { name: string; model: string } | null = null;
    for (const candidate of candidates) {
      try {
        this.ensureCapabilities(request, candidate.provider);
        const provider = this.providers.get(candidate.provider);
        const result = await provider.generate(request, requestId, candidate.model);
        const modelEntry = MODEL_CATALOG.find((model) => model.publicName === request.model && model.provider === candidate.provider);
        const cost = calculateCostUsd(modelEntry, result.usage.input_tokens, result.usage.output_tokens);
        result.usage.cost_usd = cost;
        result.response.usage = result.usage;
        result.response.provider = { name: candidate.provider, model: candidate.model };
        await this.recordUsage(requestId, request, candidate.provider, result.usage, auth);
        return result.response;
      } catch (error) {
        lastError = error as Error & { status?: number };
        lastProvider = { name: candidate.provider, model: candidate.model };
        const status = (error as { status?: number }).status;
        if (error instanceof HttpException) {
          const responseBody = error.getResponse() as { code?: string };
          if (responseBody.code === 'CAPABILITY_UNSUPPORTED') {
            continue;
          }
        }
        if (status === 429) {
          await sleep(200);
          continue;
        }
        if (status && status >= 500) {
          continue;
        }
        if (!status) {
          continue;
        }
        throw new HttpException(
          { code: 'PROVIDER_UNAVAILABLE', message: lastError.message },
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    throw new HttpException(
      {
        code: 'PROVIDER_UNAVAILABLE',
        message: lastError?.message ?? 'Provider failed',
        provider: lastProvider
          ? {
              name: lastProvider.name,
              status_code: lastError?.status,
              raw_message: lastError?.message,
            }
          : undefined,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  async *stream(
    request: UnifiedRequest,
    requestId: string,
    auth: { apiKeyId: string; tenantId: string; projectId: string },
  ): AsyncGenerator<SSEEvent, UnifiedResponse, void> {
    const decision = this.router.route(request);
    const candidates = [
      { provider: decision.provider, model: decision.providerModel },
      ...decision.fallback.map((fallback) => ({ provider: fallback.provider, model: fallback.providerModel })),
    ];

    let lastError: (Error & { status?: number }) | null = null;
    let lastProvider: { name: string; model: string } | null = null;
    for (const candidate of candidates) {
      try {
        this.ensureCapabilities(request, candidate.provider);
        const provider = this.providers.get(candidate.provider);
        const stream = provider.stream(request, requestId, candidate.model);
        let finalResult: UnifiedResponse | null = null;
        for await (const event of stream) {
          if (event.type === 'response.completed') {
            finalResult = event.data as UnifiedResponse;
          }
          yield event;
        }
        if (!finalResult) {
          throw new Error('Stream completed without response');
        }
        const usage = finalResult.usage ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0 };
        const modelEntry = MODEL_CATALOG.find((model) => model.publicName === request.model && model.provider === candidate.provider);
        const cost = calculateCostUsd(modelEntry, usage.input_tokens, usage.output_tokens);
        usage.cost_usd = cost;
        finalResult.usage = usage;
        finalResult.provider = { name: candidate.provider, model: candidate.model };
        await this.recordUsage(requestId, request, candidate.provider, usage, auth);
        return finalResult;
      } catch (error) {
        lastError = error as Error & { status?: number };
        lastProvider = { name: candidate.provider, model: candidate.model };
        const status = (error as { status?: number }).status;
        if (error instanceof HttpException) {
          const responseBody = error.getResponse() as { code?: string };
          if (responseBody.code === 'CAPABILITY_UNSUPPORTED') {
            continue;
          }
        }
        if (status === 429) {
          await sleep(200);
          continue;
        }
        if (status && status >= 500) {
          continue;
        }
        if (!status) {
          continue;
        }
        throw error;
      }
    }

    throw new HttpException(
      {
        code: 'PROVIDER_UNAVAILABLE',
        message: lastError?.message ?? 'Provider failed',
        provider: lastProvider
          ? {
              name: lastProvider.name,
              status_code: lastError?.status,
              raw_message: lastError?.message,
            }
          : undefined,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

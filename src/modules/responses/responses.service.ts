import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RouterService } from '../../core/router/router.service';
import { ProviderRegistry } from '../../providers/provider.registry';
import { UnifiedRequest, UnifiedResponse, SSEEvent } from '../../core/unified-schema/types';
import { PrismaService } from '../../common/prisma.service';
import { CostCalculator } from '../usage/billing';
import { HealthService } from '../../core/router/health.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ResponsesService {
  private readonly costCalculator = new CostCalculator();

  constructor(
    private readonly router: RouterService,
    private readonly providers: ProviderRegistry,
    private readonly prisma: PrismaService,
    private readonly health: HealthService,
  ) {}


  private async recordUsage(
    requestId: string,
    request: UnifiedRequest,
    providerName: string,
    usage: { input_tokens: number; output_tokens: number; total_tokens: number; cost_usd: number },
    priceDetails: {
      version: string;
      unit_prices: { input_per_1k: number; output_per_1k: number };
      breakdown: Prisma.InputJsonValue;
    },
    modelVariantId: string,
    auth: { apiKeyId: string; tenantId: string; projectId: string; apiKeyPrefix: string },
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
        modelVariantId,
        metricJson: {
          price_version: priceDetails.version,
          unit_prices: priceDetails.unit_prices,
          breakdown: priceDetails.breakdown,
        },
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

  async generate(
    request: UnifiedRequest,
    requestId: string,
    auth: { apiKeyId: string; tenantId: string; projectId: string; apiKeyPrefix: string },
  ): Promise<UnifiedResponse> {
    const tags = Array.isArray(request.metadata?.tags) ? (request.metadata?.tags as string[]) : undefined;
    const decision = await this.router.route(request, {
      tenantId: auth.tenantId,
      projectId: auth.projectId,
      apiKeyPrefix: auth.apiKeyPrefix,
      tags,
    });
    const candidates = [decision.primary, ...decision.fallback];

    let lastError: (Error & { status?: number }) | null = null;
    let lastProvider: { name: string; model: string } | null = null;
    for (const candidate of candidates) {
      const start = Date.now();
      try {
        const provider = this.providers.get(candidate.provider);
        const result = await provider.generate(request, requestId, candidate.providerModel);
        const latencyMs = Date.now() - start;
        await this.health.recordSuccess(candidate.variantId, latencyMs);
        const cost = this.costCalculator.calculate(
          candidate.price,
          result.usage.input_tokens,
          result.usage.output_tokens,
        );
        result.usage.cost_usd = cost.cost_usd;
        result.response.usage = result.usage;
        result.response.provider = { name: candidate.provider, model: candidate.providerModel, region: candidate.region };
        await this.recordUsage(
          requestId,
          request,
          candidate.provider,
          result.usage,
          {
            version: candidate.price.version,
            unit_prices: candidate.price.unit_prices,
            breakdown: cost.breakdown as Prisma.InputJsonValue,
          },
          candidate.variantId,
          auth,
        );
        return result.response;
      } catch (error) {
        lastError = error as Error & { status?: number };
        lastProvider = { name: candidate.provider, model: candidate.providerModel };
        await this.health.recordFailure(candidate.variantId, Date.now() - start);
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
    auth: { apiKeyId: string; tenantId: string; projectId: string; apiKeyPrefix: string },
  ): AsyncGenerator<SSEEvent, UnifiedResponse, void> {
    const tags = Array.isArray(request.metadata?.tags) ? (request.metadata?.tags as string[]) : undefined;
    const decision = await this.router.route(request, {
      tenantId: auth.tenantId,
      projectId: auth.projectId,
      apiKeyPrefix: auth.apiKeyPrefix,
      tags,
    });
    const candidates = [decision.primary, ...decision.fallback];

    let lastError: (Error & { status?: number }) | null = null;
    let lastProvider: { name: string; model: string } | null = null;
    for (const candidate of candidates) {
      const start = Date.now();
      try {
        const provider = this.providers.get(candidate.provider);
        const stream = provider.stream(request, requestId, candidate.providerModel);
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
        const latencyMs = Date.now() - start;
        await this.health.recordSuccess(candidate.variantId, latencyMs);
        const usage = finalResult.usage ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0 };
        const cost = this.costCalculator.calculate(candidate.price, usage.input_tokens, usage.output_tokens);
        usage.cost_usd = cost.cost_usd;
        finalResult.usage = usage;
        finalResult.provider = { name: candidate.provider, model: candidate.providerModel, region: candidate.region };
        await this.recordUsage(
          requestId,
          request,
          candidate.provider,
          usage,
          {
            version: candidate.price.version,
            unit_prices: candidate.price.unit_prices,
            breakdown: cost.breakdown as Prisma.InputJsonValue,
          },
          candidate.variantId,
          auth,
        );
        return finalResult;
      } catch (error) {
        lastError = error as Error & { status?: number };
        lastProvider = { name: candidate.provider, model: candidate.providerModel };
        await this.health.recordFailure(candidate.variantId, Date.now() - start);
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregate(tenantId: string, projectId: string, from?: Date, to?: Date) {
    const where: any = { tenantId, projectId };
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = from;
      }
      if (to) {
        where.createdAt.lte = to;
      }
    }

    const events = await this.prisma.usageEvent.findMany({ where });
    const byModel = new Map<string, { model: string; cost_usd: number; tokens: number }>();
    let totalCost = 0;
    let totalTokens = 0;

    for (const event of events) {
      totalCost += event.costUsd;
      totalTokens += event.totalTokens;
      const existing = byModel.get(event.model) ?? { model: event.model, cost_usd: 0, tokens: 0 };
      existing.cost_usd += event.costUsd;
      existing.tokens += event.totalTokens;
      byModel.set(event.model, existing);
    }

    return {
      total_cost_usd: totalCost,
      total_tokens: totalTokens,
      by_model: Array.from(byModel.values()),
    };
  }
}

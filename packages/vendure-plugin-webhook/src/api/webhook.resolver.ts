import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { WebhookService } from './webhook.service';
import { webhookPermission } from '../index';

/**
 * Graphql resolvers for retrieving and updating webhook for channel
 */
@Resolver()
export class WebhookResolver {
  constructor(private webhookService: WebhookService) {}

  @Query()
  @Allow(webhookPermission.Permission)
  async webhook(@Ctx() ctx: RequestContext): Promise<string | undefined> {
    const webhook = await this.webhookService.getWebhookConfiguration(
      ctx.channelId as string
    );
    return webhook?.url;
  }

  @Mutation()
  @Allow(webhookPermission.Permission)
  async updateWebhook(
    @Ctx() ctx: RequestContext,
    @Args('url') url: string
  ): Promise<string | undefined> {
    const webhook = await this.webhookService.saveWebhook(
      url,
      ctx.channelId as string
    );
    return webhook?.url;
  }
}

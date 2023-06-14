import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  ProductEvent,
  RequestContext,
} from '@vendure/core';
import { WebhookService } from './webhook.service';
import {
  Webhook,
  WebhookInput,
  WebhookRequestTransformer,
} from '../generated/graphql-types';
import { Webhook as WebhookEntity } from './webhook.entity';
import { RequestTransformer } from './request-transformer';

// Permission needs to be defined first
export const webhookPermission = new PermissionDefinition({
  name: 'SetWebhook',
  description: 'Allows setting a webhook URL',
});

/**
 * Graphql resolvers for retrieving and updating webhook for channel
 */
@Resolver()
export class WebhookResolver {
  constructor(private webhookService: WebhookService) {}

  @Mutation()
  @Allow(webhookPermission.Permission)
  async setWebhooks(
    @Ctx() ctx: RequestContext,
    @Args('webhooks') webhooks: WebhookInput[]
  ): Promise<Webhook[]> {
    return this.webhookService.saveWebhooks(ctx, webhooks);
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async webhooks(@Ctx() ctx: RequestContext): Promise<Webhook[]> {
    return this.webhookService.getAllWebhooks(ctx);
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async availableWebhookEvents(): Promise<string[]> {
    return this.webhookService.getAvailableEvents();
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async availableWebhookRequestTransformers(): Promise<
    WebhookRequestTransformer[]
  > {
    const transformers = this.webhookService.getAvailableTransformers();
    return transformers.map(mapToGraphqlTransformer);
  }
}

@Resolver('Webhook')
export class WebhookRequestTransformerResolver {
  constructor(private webhookService: WebhookService) {}

  /**
   * Resolve `webhook.transformerName` to the actual RequestTransformer object
   */
  @ResolveField()
  async requestTransformer(
    @Ctx() ctx: RequestContext,
    @Parent() webhook: WebhookEntity
  ): Promise<WebhookRequestTransformer | undefined> {
    if (!webhook.transformerName) {
      return;
    }
    const transformers = this.webhookService.getAvailableTransformers();
    const transformer = transformers.find(
      (t) => t.name === webhook.transformerName
    );
    if (!transformer) {
      return;
    }
    return mapToGraphqlTransformer(transformer);
  }
}

export function mapToGraphqlTransformer(
  transformer: RequestTransformer<any>
): WebhookRequestTransformer {
  return {
    name: transformer.name,
    supportedEvents: transformer.supportedEvents.map(
      (event: any) => event.name
    ),
  };
}

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  ChannelService,
  Logger, Order, OrderItem,
  ProductVariant,
  ProductVariantService,
  RequestContext
} from "@vendure/core";
import { GgLoggerContext, GoedgepicktPlugin } from './goedgepickt.plugin';
import { GoedgepicktClient } from './goedgepickt.client';
import {
  IncomingOrderStatusEvent, IncomingStockUpdateEvent,
  Order as GgOrder,
  OrderInput,
  OrderItemInput,
  Product as GgProduct
} from "./goedgepickt.types";
import { UpdateProductVariantInput } from '@vendure/common/lib/generated-types';

@Injectable()
export class GoedgepicktService implements OnApplicationBootstrap {
  // TODO send products to GP on startup via worker!
  // TODO Get stocklevels from GP on startup

  constructor(
    private variantService: ProductVariantService,
    private channelService: ChannelService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    /*    for (const { channelToken } of GoedgepicktPlugin.config.configPerChannel) {
          // TODO Push a message per channel to worker
          await this.pushProducts(channelToken).catch((error) => {
            console.error(error);
            Logger.error(
              `Failed to sync products for ${channelToken}: ${error.message}`,
              GgLoggerContext
            );
          });
        }*/
  }

  /**
   * Push all products to Goedgepickt for channel
   */
  async pushProducts(channelToken: string): Promise<void> {
    const variants = await this.getAllVariants(channelToken);
    const client = this.getClientForChannel(channelToken);
    for (const variant of variants) {
      await client
        .createProduct({
          name: variant.name,
          sku: variant.sku,
          productId: variant.sku,
          stockManagement: true,
        })
        .then(() =>
          Logger.info(
            `'${variant.sku}' synced to Goedgepickt`,
            GgLoggerContext
          )
        )
        .catch((error: Error) => {
          if (error?.message?.indexOf('already exists') > -1) {
            Logger.info(
              `Variant '${variant.sku}' already exists in Goedgepickt. Skipping...`,
              GgLoggerContext
            );
          } else {
            throw error; // Throw if any other error than already exists
          }
        });
    }
  }

  /**
   * Pull all stocklevels from Goedgepickt and update in Vendure
   */
  async pullStocklevels(channelToken: string): Promise<void> {
    const client = this.getClientForChannel(channelToken);
    const ggProducts: GgProduct[] = [];
    let page = 1;
    while (true) {
      const results = await client.getProducts(page);
      if (!results || results.length === 0) {
        break;
      }
      ggProducts.push(...results);
      page++;
    }
    const variants = await this.getAllVariants(channelToken);
    const stockPerVariant: UpdateProductVariantInput[] = [];
    for (const ggProduct of ggProducts) {
      const variant = variants.find((v) => v.sku === ggProduct.sku);
      const newStock = ggProduct.stock?.freeStock;
      if (!newStock) {
        Logger.warn(
          `Goedgepickt variant ${ggProduct.sku} has no stock set. Cannot update stock in Vendure for this variant.`,
          GgLoggerContext
        );
        continue;
      }
      if (variant) {
        stockPerVariant.push({
          id: variant.id as string,
          stockOnHand: newStock,
        });
        Logger.info(
          `Updating variant ${variant.sku} to have ${newStock} stockOnHand`,
          GgLoggerContext
        );
      } else {
        Logger.warn(
          `Goedgepickt product with sku ${ggProduct.sku} doesn't exist as variant in Vendure. Not updating stock for this variant`,
          GgLoggerContext
        );
      }
    }
    const ctx = await this.getCtxForChannel(channelToken);
    await this.variantService.update(ctx, stockPerVariant);
  }

  /**
   * Accepts the order and corresponding orderItems, because fulfillment can take place for a partial order
   * @param channelToken
   * @param order
   * @param orderItems
   */
  async createOrder(channelToken: string, order: Order, orderItems: OrderItem[]): Promise<GgOrder> {
    const mergedItems: OrderItemInput[] = [];
    // Merge same SKU's into single item with quantity
    orderItems.forEach(orderItem => {
      const existingItem = mergedItems.find(i => i.sku === orderItem.line.productVariant.sku);
      if (existingItem) {
        existingItem.productQuantity++;
      } else {
        mergedItems.push({
          sku: orderItem.line.productVariant.sku,
          productName: orderItem.line.productVariant.name,
          productQuantity: 1, // OrderItems are always 1 each
          taxRate: orderItem.taxRate
        })
      }
    })
    const client = this.getClientForChannel(channelToken);
    return client.createOrder({
      orderId: order.code,
      createDate: order.createdAt,
      finishDate: order.orderPlacedAt,
      orderStatus: 'open',
      orderItems: mergedItems
    });
  }

  /**
   * Update order status in Vendure based on event
   */
  async updateOrderStatus(event: IncomingOrderStatusEvent): Promise<void> {

    Logger.info(`Updated order status of ${event.orderNumber}`, GgLoggerContext);
  }

  /**
   * Update stock in Vendure based on event
   */
  async updateStock(event: IncomingStockUpdateEvent): Promise<void> {

    Logger.info(`Updated stock for ${event.productSku}`, GgLoggerContext);
  }

  getClientForChannel(channelToken: string): GoedgepicktClient {
    const clientConfig = GoedgepicktPlugin.config?.configPerChannel.find(
      (c) => c.channelToken === channelToken
    );
    if (!clientConfig) {
      throw Error(`No Goedgepickt config found for channel ${channelToken}`);
    }
    return new GoedgepicktClient(clientConfig);
  }

  /**
   * Creates admin context for channel
   */
  async getCtxForChannel(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }

  private async getAllVariants(
    channelToken: string
  ): Promise<ProductVariant[]> {
    const ctx = await this.getCtxForChannel(channelToken);
    const result = await this.variantService.findAll(ctx, {
      skip: 0,
      take: 10000,
    }); // Sensible max of 10 000 variants per channel
    if (result.totalItems > result.items.length) {
      Logger.error(
        `This plugin supports a max of ${result.items.length} variants per channel. Channel ${channelToken} has ${result.totalItems} variants. Only processing first ${result.items} variants`,
        GgLoggerContext
      );
    }
    return result.items;
  }
}

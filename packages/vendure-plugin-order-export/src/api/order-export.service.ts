import { Inject, Injectable } from '@nestjs/common';
import { OrderExportPluginConfig } from '../order-export.plugin';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import {
  OrderExportResult,
  OrderExportResultFilter,
  OrderExportResultList,
} from '../ui/generated/graphql';
import {
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Repository } from 'typeorm';
import { OrderExportResultEntity } from './order-export-result.entity';
import { OrderExportConfigEntity } from './order-export-config.entity';
import { SortOrder } from '@vendure/core';

@Injectable()
export class OrderExportService {
  exportRepo: Repository<OrderExportResultEntity>;
  configRepo: Repository<OrderExportConfigEntity>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private config: OrderExportPluginConfig,
    private connection: TransactionalConnection,
    private orderService: OrderService
  ) {
    this.exportRepo = connection.getRepository(OrderExportResultEntity);
    this.configRepo = connection.getRepository(OrderExportConfigEntity);
  }

  async getOrderExportResults(
    ctx: RequestContext,
    filter: OrderExportResultFilter
  ): Promise<OrderExportResultList> {
    const take = filter.itemsPerPage;
    const skip = filter.page > 1 ? (filter.page - 1) * take : 0;
    const { items, totalItems } = await this.orderService.findAll(ctx, {
      skip,
      take,
      sort: { orderPlacedAt: 'DESC' as any },
    });
    const whereClauses = items.map((item) => ({ orderId: item.id }));
    const exports = await this.exportRepo.find({ where: whereClauses });
    return {
      totalItems,
      items: items.map((item) => this.mapToOrderExportResult(item, exports)),
    };
  }

  private mapToOrderExportResult(
    order: Order,
    exports: OrderExportResultEntity[]
  ): OrderExportResult {
    const orderExport = exports.find((ex) => ex.orderId === order.id);
    return {
      id: (orderExport?.id as string) || `runtimeId-${order.id}`, // Construct a temp ID, because no export exists yet
      createdAt: orderExport?.createdAt,
      updatedAt: orderExport?.updatedAt,
      orderPlacedAt: order.orderPlacedAt,
      orderId: orderExport?.orderId || (order.id as string),
      orderCode: order.code,
      customerEmail: order.customer?.emailAddress,
      externalLink: orderExport?.externalLink,
      message: orderExport?.message,
      reference: orderExport?.reference,
      successful: orderExport?.successful,
    };
  }
}

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { StockMovementType } from '@vendure/common/lib/generated-types';
import {
  Allocation,
  EventBus,
  ID,
  Logger,
  Order,
  OrderLine,
  ProductVariant,
  ProductVariantService,
  RequestContext,
  StockLevelService,
  StockMovementEvent,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { In } from 'typeorm';
import { loggerCtx } from '../constants';
import { OrderIntegrationService } from './order-integration.service';
import {
  findStockShortfalls,
  LineAllocation,
  StockShortfallLine,
} from './stock-shortfall.util';

/**
 * Derives `onStockShortfall` events, because Vendure publishes none: whenever stock is
 * allocated to lines of a placed order, each line that was allocated more than the stock
 * on hand not allocated elsewhere is reported.
 */
@Injectable()
export class StockShortfallService implements OnApplicationBootstrap {
  constructor(
    protected readonly orderIntegrationService: OrderIntegrationService,
    private readonly eventBus: EventBus,
    private readonly connection: TransactionalConnection,
    private readonly productVariantService: ProductVariantService,
    private readonly stockLevelService: StockLevelService,
  ) {}

  /** Subscribes to `StockMovementEvent`s of type `ALLOCATION`. */
  onApplicationBootstrap(): void {
    this.eventBus.ofType(StockMovementEvent).subscribe((event) => {
      if (event.type !== StockMovementType.ALLOCATION) {
        return;
      }
      this.reportShortfalls(event).catch((e) =>
        Logger.error(
          `Failed to report stock shortfalls: ${asError(e).message}`,
          loggerCtx,
          asError(e).stack,
        ),
      );
    });
  }

  /**
   * Dispatches `onStockShortfall` for every placed order that was allocated more stock
   * than was on hand.
   */
  private async reportShortfalls(event: StockMovementEvent): Promise<void> {
    const { ctx } = event;
    // Read nothing from the database when no strategy implements the hook;
    // dispatch() evaluates isEnabled
    if (!this.orderIntegrationService.isImplemented('onStockShortfall')) {
      return;
    }
    const allocations = event.stockMovements as Allocation[];
    const placedLines = await this.loadPlacedLines(ctx, allocations);
    try {
      const shortfalls = await this.findShortfalls(
        ctx,
        allocations,
        placedLines,
      );
      await this.dispatchShortfalls(event, placedLines, shortfalls);
    } catch (e) {
      // The orders are known from here on, so the failure is logged with their codes
      const orderCodes = new Set(
        [...placedLines.values()].map(({ order }) => order.code),
      );
      Logger.error(
        `Failed to report stock shortfalls of order(s) ${[...orderCodes].join(', ')}: ${asError(e).message}`,
        loggerCtx,
        asError(e).stack,
      );
    }
  }

  /** Loads the allocated order lines with their order and keeps those of placed orders. */
  private async loadPlacedLines(
    ctx: RequestContext,
    allocations: Allocation[],
  ): Promise<Map<ID, OrderLine>> {
    const lineIds = new Set(allocations.map(({ orderLine }) => orderLine.id));
    const lines = await this.connection.getRepository(ctx, OrderLine).find({
      where: { id: In([...lineIds]) },
      relations: { order: true },
      order: { id: 'ASC' },
    });
    return new Map(
      lines
        .filter((line) => line.order.orderPlacedAt)
        .map((line) => [line.id, line] as const),
    );
  }

  /** Returns the lines of placed orders that were allocated more than their variant had in stock. */
  private async findShortfalls(
    ctx: RequestContext,
    allocations: Allocation[],
    placedLines: Map<ID, OrderLine>,
  ): Promise<StockShortfallLine[]> {
    // Group the allocations of placed lines by variant
    const allocationsByVariant = new Map<ID, LineAllocation[]>();
    for (const { orderLine, quantity } of allocations) {
      const line = placedLines.get(orderLine.id);
      if (!line) {
        continue;
      }
      const variantAllocations =
        allocationsByVariant.get(line.productVariantId) ?? [];
      variantAllocations.push({ orderLineId: line.id, quantity });
      allocationsByVariant.set(line.productVariantId, variantAllocations);
    }
    // Compare the stock of every tracked variant with what was allocated
    const shortfalls: StockShortfallLine[] = [];
    for (const [variantId, variantAllocations] of allocationsByVariant) {
      if (!(await this.isInventoryTracked(ctx, variantId))) {
        continue;
      }
      const stock = await this.stockLevelService.getAvailableStock(
        ctx,
        variantId,
      );
      shortfalls.push(...findStockShortfalls(stock, variantAllocations));
    }
    return shortfalls;
  }

  /** Whether Vendure tracks the inventory of the variant, with `INHERIT` resolved. */
  private async isInventoryTracked(
    ctx: RequestContext,
    variantId: ID,
  ): Promise<boolean> {
    const variant = await this.connection.getEntityOrThrow(
      ctx,
      ProductVariant,
      variantId,
      { includeSoftDeleted: true, loadEagerRelations: false },
    );
    const saleableStock =
      await this.productVariantService.getSaleableStockLevel(ctx, variant);
    return saleableStock !== Number.MAX_SAFE_INTEGER;
  }

  /** Dispatches one `onStockShortfall` per order that has short lines. */
  private async dispatchShortfalls(
    event: StockMovementEvent,
    placedLines: Map<ID, OrderLine>,
    shortfalls: StockShortfallLine[],
  ): Promise<void> {
    // Group the short lines by order, following the order of the lines
    const shortfallByLineId = new Map(
      shortfalls.map(
        (shortfall) => [shortfall.orderLineId, shortfall] as const,
      ),
    );
    const shortfallsByOrderId = new Map<
      ID,
      { order: Order; lines: StockShortfallLine[] }
    >();
    for (const { id, order } of placedLines.values()) {
      const shortfall = shortfallByLineId.get(id);
      if (!shortfall) {
        continue;
      }
      const orderShortfalls = shortfallsByOrderId.get(order.id) ?? {
        order,
        lines: [],
      };
      orderShortfalls.lines.push(shortfall);
      shortfallsByOrderId.set(order.id, orderShortfalls);
    }
    // Dispatch once per order
    for (const { order, lines } of shortfallsByOrderId.values()) {
      await this.orderIntegrationService.dispatch(
        event.ctx,
        'onStockShortfall',
        {
          orderIds: [order.id],
          orderCodes: [order.code],
          data: { lines },
          occurredAt: event.createdAt,
        },
      );
    }
  }
}

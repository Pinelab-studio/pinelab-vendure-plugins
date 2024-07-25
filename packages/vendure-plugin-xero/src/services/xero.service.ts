import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ID, JobQueue, JobQueueService, Logger, Order, OrderService, RequestContext, SerializedRequestContext } from '@vendure/core';
import { VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { XeroPluginOptions } from '../xero.plugin';
import { XeroClient } from 'xero-node';

export type XeroStatus = 'Exported' | 'Not exported' | 'Failed';

export interface JobData {
    ctx: SerializedRequestContext
    orderIds: ID[]
}

@Injectable()
export class XeroService implements OnModuleInit {
    private jobQueue!: JobQueue<JobData>;

    constructor(
        private readonly orderService: OrderService,
        @Inject(VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS)
        private options: XeroPluginOptions, private jobQueueService: JobQueueService
    ) { }

    public async onModuleInit(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'xero',
            process: async job => {
                // Deserialize the RequestContext from the job data
                const ctx = RequestContext.deserialize(job.data.ctx);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await this.handleSendToXeroJob(ctx, job.data.orderIds).catch((e: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    Logger.error(`Failed to handle sentToXero job: ${e?.message}`, loggerCtx);
                    throw e;
                });
            },
        })
    }

    async handleSendToXeroJob(ctx: RequestContext, orderIds: ID[]): Promise<void> {
        // TODO get all orders in 1 DB call
        const {items} = await this.orderService.findAll(ctx, { filter: { id: { in: orderIds as string[] } } });
        for (const order of items) {
            await this.sendOrder(ctx, order);
        }
    }

    /**
     * Create a job to send the specified orders to Xero
     */
    async createSendToXeroJobs(ctx: RequestContext, orderIds: ID[]): Promise<void> {
        // TODO check if any of these orders is not-placed in a performant way. If so, throw an error and don't add the job to the queue

        await this.jobQueue.add({
            ctx: ctx.serialize(),
            orderIds,
        });
    }

    /**
     * Sends a single order to Xero
     */
    async sendOrder(ctx: RequestContext, order: Order): Promise<void> {
        try {
            // TODO send order to xero, and update the orders `xeroStatus`

            Logger.info(`Sent order ${order.code} to Xero`, loggerCtx);
        } catch (e) {
            // TODO log note on order and throw
            throw e;
        }
    }

    async getClient(ctx: RequestContext): Promise<XeroClient> {
        // TODO create client based on this channels config
    }
}

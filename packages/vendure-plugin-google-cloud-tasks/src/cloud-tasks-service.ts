
import { Injectable } from '@nestjs/common';
import {
    ActiveOrderService,
    ChannelService,
    EntityHydrator,
    ErrorResult,
    ListQueryBuilder,
    Logger,
    OrderService,
    OrderStateTransitionError,
    PaymentMethodService,
    RequestContext,
} from '@vendure/core';
import { coinbaseHandler } from './coinbase.handler';
import { loggerCtx } from './constants';
import { CoinbaseClient } from './coinbase.client';
import { Repository, DataSource } from 'typeorm';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@Injectable()
export class CloudTasksService {

    constructor(
        private readonly listQueryBuilder: ListQueryBuilder,
        private readonly dataSource: DataSource
    )


    private  | undefined;
    private jobRecordRepository!: Repository<JobRecord>;
}
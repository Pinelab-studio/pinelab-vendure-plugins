import {
  ChannelService,
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { createClientAsync, EBoekhoudenWsdlClient, ErrorMsg } from '../client';
import { loggerCtx } from '../constants';
import { EBoekhoudenAdapter } from './e-boekhouden.adapter';

interface JobData {
  channelToken: string;
  orderCode: string;
}

@Injectable()
export class EBoekhoudenService
  implements OnApplicationBootstrap, OnModuleInit
{
  client!: EBoekhoudenWsdlClient;
  jobQueue!: JobQueue<JobData>;

  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private channelService: ChannelService,
    private eventBus: EventBus,
    private jobQueueService: JobQueueService
  ) {}

  async onModuleInit(): Promise<void> {
    const url = 'https://soap.e-boekhouden.nl/soap.asmx?wsdl';
    const options = {
      envelopeKey: 'soap',
      wsdl_options: {
        xmlKey: '$xml',
        overrideRootElement: {
          namespace: 'xmlns:soap',
        },
      },
    };
    this.client = await createClientAsync(url, options);
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'push-orders-to-e-boekhouden',
      process: async (job) => await this.pushOrder(job.data),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(
      async (event) =>
        await this.jobQueue.add({
          channelToken: event.ctx.channel.token,
          orderCode: event.order.code,
        })
    );
  }

  /**
   * Get the e-Boekhouden config for the given channel from its custom fields.
   * Returns null when e-Boekhouden is disabled or the config is incomplete for the channel.
   */
  async getConfig(
    channelToken: string
  ): Promise<EBoekhoudenChannelConfig | null> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    const {
      eBoekhoudenEnabled,
      eBoekhoudenUsername,
      eBoekhoudenSecret1,
      eBoekhoudenSecret2,
      eBoekhoudenAccount,
      eBoekhoudenContraAccount,
    } = channel.customFields;
    if (
      !eBoekhoudenEnabled ||
      !eBoekhoudenUsername ||
      !eBoekhoudenSecret1 ||
      !eBoekhoudenSecret2 ||
      !eBoekhoudenAccount ||
      !eBoekhoudenContraAccount
    ) {
      return null;
    }
    return {
      channelToken,
      enabled: eBoekhoudenEnabled,
      username: eBoekhoudenUsername,
      secret1: eBoekhoudenSecret1,
      secret2: eBoekhoudenSecret2,
      account: eBoekhoudenAccount,
      contraAccount: eBoekhoudenContraAccount,
    };
  }

  async pushOrder({ orderCode, channelToken }: JobData): Promise<void> {
    const config = await this.getConfig(channelToken);
    if (!config?.enabled) {
      return;
    }
    const channel = await this.channelService.getChannelFromToken(channelToken);
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      channel,
      authorizedAsOwnerOnly: false,
    });
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      Logger.error(
        `No order with code ${orderCode} found. Not retrying this job`,
        loggerCtx
      );
      return;
    }
    let sessionId: string | undefined;
    try {
      sessionId = await this.openSession(config);
      const mutation = EBoekhoudenAdapter.toMutation(ctx, order, config);
      const result = await this.client.AddMutatieAsync({
        SessionID: sessionId,
        SecurityCode2: config.secret2,
        oMut: mutation,
      });
      this.validate(result[0].AddMutatieResult);
      Logger.info(
        `Successfully send order ${orderCode} to e-boekhouden with mutationNr ${result?.[0]?.AddMutatieResult?.Mutatienummer}`,
        loggerCtx
      );
    } catch (e: any) {
      Logger.error(
        `Failed to push order ${order.code} for channel ${config.channelToken} to account ${config.username}: ${e?.message}`,
        loggerCtx,
        e
      );
      throw e;
    } finally {
      if (sessionId) {
        await this.closeSession(sessionId);
      }
    }
  }

  private async openSession(config: EBoekhoudenChannelConfig): Promise<string> {
    const openSession = await this.client.OpenSessionAsync({
      SecurityCode1: config.secret1,
      SecurityCode2: config.secret2,
      Username: config.username,
    });
    this.validate(openSession[0].OpenSessionResult);
    const sessionId = openSession[0].OpenSessionResult?.SessionID;
    if (!sessionId) {
      throw Error(
        `No SessionID from OpenSession for account ${config.username}`
      );
    }
    return sessionId;
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.client.CloseSessionAsync({ SessionID: sessionId });
  }

  private validate(res?: { ErrorMsg?: ErrorMsg }) {
    if (res?.ErrorMsg?.LastErrorDescription || res?.ErrorMsg?.LastErrorCode) {
      throw Error(
        `${res.ErrorMsg?.LastErrorCode} - ${res.ErrorMsg?.LastErrorDescription}`
      );
    }
  }
}

export interface EBoekhoudenChannelConfig {
  channelToken: string;
  enabled: boolean;
  username: string;
  secret1: string;
  secret2: string;
  account: string;
  contraAccount: string;
}

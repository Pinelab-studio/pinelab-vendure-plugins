import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Injector,
  InternalServerError,
  JobQueue,
  JobQueueService,
  Logger,
  RequestContext,
  SerializedRequestContext,
  UserInputError,
} from '@vendure/core';
import { GOOGLE_SHEET_PLUGIN_OPTIONS, loggerCtx } from '../constants';

import {
  GoogleSheetLoaderPluginOptions,
  SheetContent,
  SheetMetadata,
} from '../types';

const GOOGLE_SPREASHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets`;

type JobData = {
  ctx: SerializedRequestContext;
  strategyCode: string;
  sheets: SheetContent[];
};

@Injectable()
export class GoogleSheetService implements OnModuleInit {
  // @ts-expect-error ignore -- Our sheet content is stringifiable, not sure why it says not JsonCompatible
  private jobQueue!: JobQueue<JobData>;

  constructor(
    @Inject(GOOGLE_SHEET_PLUGIN_OPTIONS)
    private readonly options: GoogleSheetLoaderPluginOptions,
    private readonly moduleRef: ModuleRef,
    private readonly jobQueueService: JobQueueService
  ) {}

  public async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'handle-sheet-loading',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        const result = await this.handleJob(ctx, job.data);
        return result;
      },
    });
  }

  /**
   * Load data from a Google Sheet
   */
  async loadDataFromGoogleSheet(ctx: RequestContext): Promise<void> {
    // First get the loader strategy for this channel
    const dataStrategy = this.options.strategies?.find((strategy) =>
      strategy.getSheetMetadata(ctx)
    );
    if (!dataStrategy) {
      throw new InternalServerError(
        `No DataStrategy provided for channel ${ctx.channel.token}`
      );
    }
    const sheetMetadata = dataStrategy.getSheetMetadata(ctx) as SheetMetadata; // We know it's a SheetMetadata because the strategy returned metadata above
    const sheets: SheetContent[] = [];
    for (const sheetName of sheetMetadata.sheets) {
      const requestUrl = `${GOOGLE_SPREASHEET_URL}/${sheetMetadata.spreadSheetId}/values/${sheetName}?key=${this.options.googleApiKey}`;
      const result = await fetch(requestUrl);
      if (!result.ok) {
        throw new UserInputError(
          `Couldn't read from Google api: ${result.statusText}`
        );
      }
      const data = (await result.json()) as any;
      sheets.push({ sheetName, data: data.values as string[][] });
    }
    const validationError = await dataStrategy.validateSheetData(ctx, sheets);
    if (validationError !== true) {
      throw new UserInputError(`Validation failed: ${validationError}`);
    }
    // Create job to handle the sheets
    await this.jobQueue.add(
      { ctx: ctx.serialize(), strategyCode: dataStrategy.code, sheets: sheets },
      { retries: 3 }
    );
  }

  async handleJob(ctx: RequestContext, jobData: JobData): Promise<string> {
    const strategyCode = jobData.strategyCode;
    const sheets = jobData.sheets;
    const dataStrategy = this.options.strategies?.find(
      (strategy) => strategy.code === strategyCode
    );
    if (!dataStrategy) {
      throw Error(
        `No DataStrategy provided for strategy ${strategyCode}. Not retrying.`
      );
    }
    try {
      const result = await dataStrategy.handleSheetData(
        ctx,
        new Injector(this.moduleRef),
        sheets
      );
      return result;
    } catch (error) {
      Logger.error(
        `Error handling job ${jobData.strategyCode}: ${error}`,
        loggerCtx
      );
      throw error;
    }
  }
}

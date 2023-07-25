import { Request, Response } from 'express';
import {
  Controller,
  Post,
  Req,
  Res,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ConfigService,
  Ctx,
  Job,
  JsonCompatible,
  Logger,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { JobState } from '@vendure/common/lib/generated-types';
import { CloudTaskMessage, ROUTE } from './types';
import { Repository } from 'typeorm';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import {
  CloudTasksJobQueueStrategy,
  PROCESS_MAP,
} from './cloud-tasks-job-queue.strategy';
import { loggerCtx } from '@vendure/core/dist/job-queue/constants';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@Controller(ROUTE)
export class CloudTasksHandler implements OnApplicationBootstrap {
  private jobRecordRepository: Repository<JobRecord>;
  private applicationBootstrapped = false;

  constructor(
    private readonly connection: TransactionalConnection,
    private configService: ConfigService
  ) {
    this.jobRecordRepository =
      this.connection!.rawConnection.getRepository(JobRecord);
  }

  onApplicationBootstrap() {
    this.applicationBootstrapped = true;
  }

  @Post('handler')
  async handler(
    @Req() req: Request,
    @Res() res: Response,
    @Ctx() ctx: RequestContext
  ): Promise<void> {
    if (!this.applicationBootstrapped) {
      // Don't try to handle jobs when application isn't fully bootstrapped
      res.sendStatus(500);
      return;
    }
    if (
      req.header('Authorization') !==
      `Bearer ${CloudTasksPlugin.options.authSecret}`
    ) {
      Logger.warn(
        `Unauthorized incoming webhook with Auth header ${req.header(
          'Authorization'
        )}`,
        loggerCtx
      );
      res.sendStatus(401);
      return;
    }
    const message: CloudTaskMessage = req.body;
    Logger.debug(
      `Received Cloud Task message ${message.id}`,
      CloudTasksPlugin.loggerCtx
    );
    const processFn = PROCESS_MAP.get(message.queueName);
    if (!processFn) {
      Logger.error(
        `No process function found for queue ${message.queueName}`,
        loggerCtx
      );
      res.sendStatus(500);
      return;
    }
    const attemptsHeader = req.header('x-cloudtasks-taskretrycount') ?? 0;
    const attempts = attemptsHeader ? parseInt(attemptsHeader) : 0;
    const job = new Job({
      id: message.id,
      queueName: message.queueName,
      data: message.data as JsonCompatible<unknown>,
      attempts: attempts,
      state: JobState.RUNNING,
      startedAt: new Date(),
      createdAt: message.createdAt,
      retries: message.maxRetries,
    });
    try {
      await processFn(job);
      // The job was completed successfully
      Logger.debug(
        `Successfully handled ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx
      );
      const jobRecord = new JobRecord({
        id: job.id,
        queueName: job.queueName,
        data: job.data,
        attempts: job.attempts,
        state: JobState.COMPLETED,
        startedAt: job.startedAt,
        createdAt: job.createdAt,
        retries: job.retries,
        isSettled: true,
        settledAt: new Date(),
        progress: 100,
      });
      // Save successful job in DB
      await this.jobRecordRepository.save(jobRecord);
      await this.safelyRemoveSettledJobs();
      res.sendStatus(200);
      return;
    } catch (error: any) {
      if (attempts === job.retries) {
        // This was the final attempt, so mark the job as failed
        Logger.error(
          `Failed to handle message ${message.id} after final attempt (${attempts} attempts made). Marking with status 200 to prevent retries: ${error}`,
          CloudTasksPlugin.loggerCtx
        );
        // Log failed job in DB
        await this.jobRecordRepository.save(
          new JobRecord({
            queueName: job.queueName,
            data: job.data,
            attempts: job.attempts,
            state: JobState.FAILED,
            startedAt: job.startedAt,
            createdAt: job.createdAt,
            retries: job.retries,
            isSettled: true,
            settledAt: new Date(),
            progress: 0,
            result: error?.message ?? error.toString(),
          })
        );
        res.sendStatus(200); // Return 200 to prevent more retries
        return;
      } else {
        // More attempts remain, so return 500 to trigger a retry
        Logger.warn(
          `Failed to handle message ${message.id} after ${attempts} attempts. Retrying... ${error}`,
          CloudTasksPlugin.loggerCtx
        );
        res.sendStatus(500);
        return;
      }
    }
  }

  /**
   * Safely remove settled jobs from the DB, meaning that it will never throw an error.
   */
  async safelyRemoveSettledJobs(): Promise<void> {
    if (!this.shouldRun()) {
      // Should only run every 1 in 100 tasks. More cleanup isn't needed
      return;
    }
    try {
      const cloudTaskJobStrategy = this.configService.jobQueueOptions
        .jobQueueStrategy as CloudTasksJobQueueStrategy;
      if (!(cloudTaskJobStrategy instanceof CloudTasksJobQueueStrategy)) {
        Logger.error(
          `Configured jobQueueStrategy is not an instance of CloudTasksJobQueueStrategy, something is broken...`,
          loggerCtx
        );
        return;
      }
      const sevenDaysAgo: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const queueNames = cloudTaskJobStrategy.getAllQueueNames();
      await cloudTaskJobStrategy.removeSettledJobs(queueNames, sevenDaysAgo);
      Logger.info(
        `Successfully removed settled jobs older than 7 days`,
        loggerCtx
      );
    } catch (e: any) {
      Logger.error(`Failed to remove settled jobs: ${e}`, loggerCtx, e.stack);
    }
  }

  /**
   * Triggers 1 out of every 100 times
   */
  private shouldRun(): boolean {
    const probability = 0.01; // 1% probability
    const randomNumber = Math.random();
    return randomNumber <= probability;
  }
}

import { Request, Response } from 'express';
import { Controller, Post, Req, Res } from '@nestjs/common';
import {
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
import { PROCESS_MAP } from './cloud-tasks-job-queue.strategy';
import { loggerCtx } from '@vendure/core/dist/job-queue/constants';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@Controller(ROUTE)
export class CloudTasksHandler {
  private jobRecordRepository: Repository<JobRecord>;

  constructor(private readonly connection: TransactionalConnection) {
    this.jobRecordRepository =
      this.connection!.rawConnection.getRepository(JobRecord);
  }

  @Post('handler')
  async handler(
    @Req() req: Request,
    @Res() res: Response,
    @Ctx() ctx: RequestContext
  ): Promise<void> {
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
      Logger.debug(
        `Successfully handled ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx
      );
      await this.jobRecordRepository
        .save(
          new JobRecord({
            id: job.id,
            queueName: job.queueName,
            data: job.data,
            attempts: job.attempts,
            state: JobState.COMPLETED,
            startedAt: job.startedAt,
            createdAt: job.createdAt,
            retries: job.retries,
            isSettled: true,
            // settledAt: new Date(),
            progress: 100,
          })
        )
        .catch((e) =>
          Logger.error(
            `Failed to save job record after job completion: ${e}`,
            CloudTasksPlugin.loggerCtx,
            e.stack
          )
        );
      res.sendStatus(200);
      return;
    } catch (error: any) {
      if (attempts === job.retries) {
        Logger.error(
          `Failed to handle message ${message.id} after final attempt (${attempts} attempts made). Marking with status 200 to prevent retries: ${error}`,
          CloudTasksPlugin.loggerCtx
        );
        await this.jobRecordRepository
          .save(
            new JobRecord({
              queueName: job.queueName,
              data: job.data,
              attempts: job.attempts,
              state: JobState.FAILED,
              startedAt: job.startedAt,
              createdAt: job.createdAt,
              retries: job.retries,
              isSettled: true,
              // settledAt: new Date(), ?????
              progress: 0,
              result: error?.message ?? error.toString(),
            })
          )
          .catch((e) =>
            Logger.error(
              `Failed to save job record after job failure: ${e}`,
              CloudTasksPlugin.loggerCtx,
              e.stack
            )
          );
        res.sendStatus(200); // Return 200 to prevent more retries
        return;
      } else {
        Logger.warn(
          `Failed to handle message ${message.id} after ${attempts} attempts. Retrying... ${error}`,
          CloudTasksPlugin.loggerCtx
        );
        res.sendStatus(500);
        return;
      }
    }
  }
}

import { Request, Response } from 'express';
import { Controller, Post, Req, Res, HttpException } from '@nestjs/common';
import {
  Job,
  JsonCompatible,
  Logger,
  TransactionalConnection,
} from '@vendure/core';
import { JobState } from '@vendure/common/lib/generated-types';
import { CloudTaskMessage, ROUTE } from './types';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { PROCESS_MAP } from './cloud-tasks-job-queue.strategy';
import { loggerCtx } from '@vendure/core/dist/job-queue/constants';
import { JobRecord } from '@vendure/core/dist/plugin/default-job-queue-plugin/job-record.entity';

@Controller(ROUTE)
export class CloudTasksHandler {
  constructor(private readonly connection: TransactionalConnection) {}

  @Post('handler')
  async handler(@Req() req: Request, @Res() res: Response): Promise<void> {
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
      await this.logJob(job);
      res.sendStatus(200);
      return;
    } catch (error: any) {
      if (attempts === job.retries) {
        Logger.error(
          `Failed to handle message ${message.id} after final attempt (${attempts} attempts made). Marking with status 200 to prevent retries: ${error}`,
          CloudTasksPlugin.loggerCtx
        );
        await this.logJob(job, error);
        res.sendStatus(200);
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

  /**
   * Log a job to the database. Will never through, just log an error
   */
  async logJob(job: Job, error?: any): Promise<void> {
    try {
      const now = new Date();
      const record = new JobRecord({
        // id: job.id,
        queueName: job.queueName,
        //data: job.data,
        state: job.state,
        progress: job.progress,
        //result: job.result,
        // error: error?.message ?? error,
        //startedAt: job.startedAt,
        //settledAt: now,
        isSettled: error ? false : true,
        retries: job.retries,
        attempts: job.attempts,
      });
      console.log('jobb', typeof record.createdAt);
      console.log('jobb settl', typeof record.settledAt);
      const result = await this.connection.rawConnection
        .getRepository(JobRecord)
        .save(record);
      console.log('STORED', result);
    } catch (e: any) {
      Logger.error(`Failed to log job to database: ${e}`, loggerCtx);
    }
  }
}

import { Request } from 'express';
import { Controller, Post, Req, HttpException } from '@nestjs/common';
import { Job, JsonCompatible, Logger } from '@vendure/core';
import { JobState } from '@vendure/common/lib/generated-types';
import { CloudTaskMessage, ROUTE } from './types';
import { CloudTasksPlugin } from './cloud-tasks.plugin';
import { PROCESS_MAP } from './cloud-tasks-job-queue.strategy';

@Controller(ROUTE)
export class CloudTasksHandler {
  @Post('handler')
  async handler(@Req() req: Request): Promise<void> {
    if (
      req.header('Authorization') !==
      `Bearer ${CloudTasksPlugin.options.authSecret}`
    ) {
      throw new HttpException('You are not authorized to do this', 401);
    }

    const message: CloudTaskMessage = req.body;
    Logger.debug(
      `Received Cloud Task message ${message.id}`,
      CloudTasksPlugin.loggerCtx
    );

    const processFn = PROCESS_MAP.get(message.queueName);
    if (!processFn) {
      throw new HttpException(
        `No process function found for queue ${message.queueName}`,
        500
      );
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
    });

    try {
      const result = await processFn(job);
      Logger.debug(
        `Successfully handled ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx
      );
      return result;
    } catch (error: any) {
      Logger.error(
        `Failed to handle message ${message.id} after ${attempts} attempts`,
        CloudTasksPlugin.loggerCtx,
        error
      );
    }
  }
}

import { Controller, Post, Req } from "@nestjs/common";
import { LanguageCode, Logger } from "@vendure/core";
import { CloudTasksPlugin } from "./cloud-tasks.plugin";
import { Request } from "express";

@Controller("cloud-tasks")
export class CloudTasksHandler {
  @Post("handler")
  async handler(@Req() req: Request): Promise<void> {
    console.log("req", (req as any).rawBody);
    console.log("req", req.body);
    // CloudTasksJobQueueStrategy.proc
    Logger.debug(`Received `, CloudTasksPlugin.loggerCtx);
  }
}

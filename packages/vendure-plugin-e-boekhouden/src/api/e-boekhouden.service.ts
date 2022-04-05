import { EventBus, TransactionalConnection } from "@vendure/core";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { EBoekhoudenConfigEntity } from "./e-boekhouden-config.entity";
import { EBoekhoudenConfigInput } from "../ui/generated/graphql";

@Injectable()
export class EBoekhoudenService implements OnApplicationBootstrap {

  constructor(
    private connection: TransactionalConnection,
    private eventBus: EventBus
  ) {
  }

  async onApplicationBootstrap(): Promise<void> {
    // Listen and push
  }

  async upsertConfig(
    channelToken: string,
    input: EBoekhoudenConfigInput
  ): Promise<EBoekhoudenConfigEntity> {
    const existing = await this.connection
      .getRepository(EBoekhoudenConfigEntity)
      .findOne({ channelToken});
    if (existing) {
      await this.connection
        .getRepository(EBoekhoudenConfigEntity)
        .update(existing.id, input);
    } else {
      await this.connection
        .getRepository(EBoekhoudenConfigEntity)
        .insert(input);
    }
    return this.connection
      .getRepository(EBoekhoudenConfigEntity)
      .findOneOrFail({ channelToken });
  }

  async getConfig(
    channelToken: string
  ): Promise<EBoekhoudenConfigEntity | undefined> {
    return this.connection
      .getRepository(EBoekhoudenConfigEntity)
      .findOne({ channelToken });
  }

  async getConfigs(): Promise<EBoekhoudenConfigEntity[]> {
    return this.connection.getRepository(EBoekhoudenConfigEntity).find();
  }
}

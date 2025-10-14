import { Mutation, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { GoogleSheetService } from '../services/google-sheet.service';
@Resolver()
export class GoogleSheetDataLoaderResolver {
  constructor(private readonly googleSheetService: GoogleSheetService) {}

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateProduct)
  async loadDataFromGoogleSheet(@Ctx() ctx: RequestContext): Promise<boolean> {
    await this.googleSheetService.loadDataFromGoogleSheet(ctx);
    return true;
  }
}

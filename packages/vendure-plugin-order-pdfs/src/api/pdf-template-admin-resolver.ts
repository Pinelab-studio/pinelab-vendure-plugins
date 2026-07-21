import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import {
  DeletionResponse,
  DeletionResult,
} from '@vendure/common/lib/generated-types';
import {
  MutationCreatePdfTemplateArgs,
  MutationDeletePdfTemplateArgs,
  MutationUpdatePdfTemplateArgs,
  PdfTemplate,
  QueryPdfTemplateArgs,
  QueryPdfTemplatesArgs,
} from '../generated/graphql';
import { OrderPDFsService } from './order-pdfs.service';

export const pdfDownloadPermission = new PermissionDefinition({
  name: 'AllowPDFDownload',
  description: 'Allow this user to download PDF templates',
});

@Resolver()
export class PDFTemplateAdminResolver {
  constructor(private readonly service: OrderPDFsService) {}

  @Mutation()
  @Allow(pdfDownloadPermission.Permission)
  async createPDFTemplate(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreatePdfTemplateArgs
  ): Promise<PdfTemplate> {
    return await this.service.createPDFTemplate(ctx, args.input);
  }

  @Mutation()
  @Allow(pdfDownloadPermission.Permission)
  async updatePDFTemplate(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationUpdatePdfTemplateArgs
  ): Promise<PdfTemplate> {
    return await this.service.updateTemplate(ctx, args.input);
  }

  @Mutation()
  @Allow(pdfDownloadPermission.Permission)
  async deletePDFTemplate(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationDeletePdfTemplateArgs
  ): Promise<DeletionResponse> {
    await this.service.deletePDFTemplate(ctx, args.id);
    return { result: DeletionResult.DELETED };
  }

  @Query()
  @Allow(pdfDownloadPermission.Permission)
  async pdfTemplates(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryPdfTemplatesArgs
  ) {
    return await this.service.getTemplatesList(ctx, args.options ?? undefined);
  }

  @Query()
  @Allow(pdfDownloadPermission.Permission)
  async pdfTemplate(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryPdfTemplateArgs
  ): Promise<PdfTemplate | undefined | null> {
    return await this.service.findTemplate(ctx, args.id);
  }
}

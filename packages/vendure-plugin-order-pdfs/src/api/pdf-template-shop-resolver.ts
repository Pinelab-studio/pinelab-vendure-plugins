import { Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { PdfTemplate } from '../generated/graphql';
import { OrderPDFsService } from './order-pdfs.service';

@Resolver()
export class PDFTemplateShopResolver {
  constructor(private readonly service: OrderPDFsService) {}

  @Query()
  async availablePDFTemplates(
    @Ctx() ctx: RequestContext
  ): Promise<PdfTemplate[]> {
    return (await this.service.getTemplates(ctx)).filter(
      (t) => t.enabled && t.public
    );
  }
}

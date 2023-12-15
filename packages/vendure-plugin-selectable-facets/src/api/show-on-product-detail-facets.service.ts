import { Injectable } from '@nestjs/common';
import {
  Facet,
  FacetValue,
  ID,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { In } from 'typeorm';
@Injectable()
export class ShowOnProductDetailFacetsService {
  constructor(private readonly conn: TransactionalConnection) {}

  async showOnProductDetailFacets(ctx: RequestContext): Promise<Facet[]> {
    const facetsRepo = this.conn.getRepository(ctx, Facet);
    return await facetsRepo.find({
      where: {
        customFields: {
          showOnProductDetail: true,
        },
      },
      relations: ['values'],
    });
  }

  async showOnProductDetailForFacets(
    ctx: RequestContext,
    facetValueIds: ID[]
  ): Promise<Facet[]> {
    const facetsRepo = this.conn.getRepository(ctx, Facet);
    return await facetsRepo.find({
      where: {
        customFields: {
          showOnProductDetailIf: {
            id: In(facetValueIds),
          },
        },
      },
      relations: ['values'],
    });
  }
}

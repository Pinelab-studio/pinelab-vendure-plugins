import { Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Facet,
  Permission,
  RequestContext,
  TransactionalConnection,
  TranslatorService,
} from '@vendure/core';

@Resolver()
export class AdminResolver {
  constructor(
    private connection: TransactionalConnection,
    private translator: TranslatorService
  ) {}

  @Query()
  @Allow(Permission.ReadFacet, Permission.ReadCatalog, Permission.ReadProduct)
  async requiredFacets(@Ctx() ctx: RequestContext): Promise<Facet[]> {
    const qb = this.connection
      .getRepository(ctx, Facet)
      .createQueryBuilder('facet')
      .leftJoinAndSelect('facet.values', 'value')
      .leftJoinAndSelect(
        'facet.customFields.showOnProductDetailIf',
        'dependencies'
      )
      .leftJoinAndSelect('facet.translations', 'ft')
      .leftJoinAndSelect('value.translations', 'vt')
      .leftJoinAndSelect('value.facet', 'value_facet')
      .leftJoinAndSelect('value_facet.translations', 'vft')
      .groupBy('facet.id')
      .addGroupBy('value.id')
      .addGroupBy('value_facet.id')
      .addGroupBy('ft.id')
      .addGroupBy('vt.id')
      .addGroupBy('vft.id')
      .addGroupBy('dependencies.id')
      .having('count(dependencies.id) > 0')
      .orHaving('facet.customFields.showOnProductDetail = true');

    return qb.getMany().then((facets) => {
      for (const facet of facets) {
        this.translator.translate(facet, ctx, ['values', ['values', 'facet']]);
      }
      return facets;
    });
  }
}

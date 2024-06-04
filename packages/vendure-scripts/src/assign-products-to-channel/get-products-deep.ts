import {
  Injector,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { FindOptionsWhere } from 'typeorm';

export async function getProductsDeep(
  ctx: RequestContext,
  injector: Injector,
  condition:
    | FindOptionsWhere<Product>
    | FindOptionsWhere<Product>[]
    | undefined,
  take: number = 10,
  skip: number = 0
) {
  const conn = injector.get(TransactionalConnection);
  const productRepo = conn.getRepository(ctx, Product);
  // using TransactionalConnection is an anti pattern, but it is the only way to ensure that only the ids are fetched
  return productRepo
    .createQueryBuilder('product')
    .select('product.id')
    .addSelect('channel.id')
    .addSelect('facet.id')
    .addSelect('asset.id')
    .addSelect('variant.id')
    .innerJoin('product.channels', 'channel')
    .innerJoin('product.variants', 'variant')
    .leftJoin('product.facetValues', 'facetValue')
    .leftJoin('facetValue.facet', 'facet')
    .leftJoin('product.assets', 'asset')
    .setFindOptions({ where: condition, take, skip })
    .getMany();
}

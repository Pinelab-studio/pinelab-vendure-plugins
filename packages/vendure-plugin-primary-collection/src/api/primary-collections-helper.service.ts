import { Injectable } from '@nestjs/common';
import {
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';

@Injectable()
export class PrimaryCollectionHelperService {
  constructor(private conn: TransactionalConnection) {}

  async setPrimaryCollectionForAllProducts(ctx: RequestContext) {
    const productsRepository = this.conn.getRepository(ctx, Product);
    const allProducts = await productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.collections', 'collection')
      .getMany();
    const updatedProducts: Partial<Product>[] = [];
    for (let product of allProducts) {
      if (!(product.customFields as any).primaryCollection) {
        const variantWithCollection = product.variants?.find(
          (v) => v.collections?.length,
        );
        if (variantWithCollection?.collections[0]) {
          updatedProducts.push({
            id: product.id,
            customFields: {
              primaryCollection: variantWithCollection?.collections[0]!,
            },
          });
        }
      }
    }
    await productsRepository.save(updatedProducts);
  }
}

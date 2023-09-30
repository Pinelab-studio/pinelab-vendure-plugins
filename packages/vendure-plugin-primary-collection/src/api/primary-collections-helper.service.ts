import { Injectable } from '@nestjs/common';
import {
  Product,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';

@Injectable()
export class PrimaryCollectionHelperService {
  constructor(
    private conn: TransactionalConnection,
    private productService: ProductService
  ) {}

  async setPrimaryCollectionForAllProducts(ctx: RequestContext) {
    const productsRepository = this.conn.getRepository(ctx, Product);
    const allProducts = await productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.collections', 'collection')
      .getMany();
    for (let product of allProducts) {
      if (!product.customFields.primaryCollection) {
        const variantWithCollection = product.variants?.find(
          (v) => v.collections?.length
        );
        product.customFields.primaryCollection =
          variantWithCollection?.collections[0]!;
      }
    }
    await productsRepository.save(allProducts);
  }
}

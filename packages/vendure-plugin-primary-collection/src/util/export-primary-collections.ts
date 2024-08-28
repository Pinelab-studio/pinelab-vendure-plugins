import { Product, ID, Collection, Logger } from '@vendure/core';
import { QueryRunner } from 'typeorm';
import { promises as fs } from 'fs';
import { loggerCtx } from '../constants';

export const EXPORTED_PRIMARY_COLLECTIONS_FILE = 'data.json';
export type ExportedPrimaryCollectionData = {
  productId: ID;
  primaryCollectionId: ID;
};

type ProductPrimaryCollectionPartial = {
  product_id: number;
  primaryCollection_id: number;
};

export async function exportPrimaryCollections(queryRunner: QueryRunner) {
  try {
    const productRepo = queryRunner.manager.getRepository(Product);
    const allProducts = (await productRepo
      .createQueryBuilder('product')
      .innerJoin(
        Collection,
        'primaryCollection',
        'primaryCollection.id = product.customFieldsPrimarycollectionId'
      )
      .select(['product.id', 'primaryCollection.id'])
      .getRawMany()) as ProductPrimaryCollectionPartial[];
    const data: ExportedPrimaryCollectionData[] = [];
    for (const product of allProducts) {
      data.push({
        productId: product.product_id,
        primaryCollectionId: product.primaryCollection_id,
      });
    }
    const jsonString: string = JSON.stringify(data, null, 2);
    await fs.writeFile(EXPORTED_PRIMARY_COLLECTIONS_FILE, jsonString);
    Logger.info(
      `Primary Collection data has been exported to ${EXPORTED_PRIMARY_COLLECTIONS_FILE}.`,
      loggerCtx
    );
  } catch (err) {
    Logger.error(`Error writing file: ${JSON.stringify(err)}`, loggerCtx);
    process.exit(1);
  }
}

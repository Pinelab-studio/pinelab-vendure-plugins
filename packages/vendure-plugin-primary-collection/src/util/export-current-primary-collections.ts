import { Product, ID, Collection, Logger } from '@vendure/core';
import { QueryRunner } from 'typeorm';
import { promises as fs } from 'fs';
import { loggerCtx } from '../constants';

export const EXPORTED_PRIMARY_COLLECTIONS_DATA_FILE_NAME = 'data.json';
export type ExportedPrimaryCollectionData = {
  productId: ID;
  primaryCollectionId: ID;
};

export async function exportCurrentPrimaryCollections(
  queryRunner: QueryRunner
) {
  const productRepo = queryRunner.manager.getRepository(Product);
  const allProducts = await productRepo.find();
  const data: ExportedPrimaryCollectionData[] = [];
  for (const product of allProducts) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if ((product.customFields as any).primaryCollection) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion
      const primaryCollection = (product.customFields as any)
        .primaryCollection as any as Collection;
      data.push({
        productId: product.id,
        primaryCollectionId: primaryCollection.id,
      });
    }
  }
  const jsonString: string = JSON.stringify(data, null, 2);
  try {
    await fs.writeFile(EXPORTED_PRIMARY_COLLECTIONS_DATA_FILE_NAME, jsonString);
    Logger.info(
      `Primary Collection data has been exported to ${EXPORTED_PRIMARY_COLLECTIONS_DATA_FILE_NAME}.`,
      loggerCtx
    );
    process.exit(0);
  } catch (err) {
    Logger.error(`Error writing file: ${JSON.stringify(err)}`, loggerCtx);
  }
}

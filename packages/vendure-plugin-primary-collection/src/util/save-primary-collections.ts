import { QueryRunner } from 'typeorm';
import { promises as fs } from 'fs';
import {
  EXPORTED_PRIMARY_COLLECTIONS_DATA_FILE_NAME,
  ExportedPrimaryCollectionData,
} from './export-current-primary-collections';
import { Channel, Logger, Product } from '@vendure/core';
import { DEFAULT_CHANNEL_CODE } from '@vendure/common/lib/shared-constants';
import { loggerCtx } from '../constants';
import { ProductPrimaryCollection } from './helpers';

export async function savePrimaryCollection(queryRunner: QueryRunner) {
  const productRepo = queryRunner.manager.getRepository(Product);
  const channelRepo = queryRunner.manager.getRepository(Channel);
  const defaultChannel = await channelRepo.findOne({
    where: { code: DEFAULT_CHANNEL_CODE },
  });
  if (!defaultChannel) {
    Logger.error(`Couldn't find the Default channel`, loggerCtx);
    process.exit(1);
  }
  const jsonData: string = await fs.readFile(
    EXPORTED_PRIMARY_COLLECTIONS_DATA_FILE_NAME,
    'utf8'
  );
  const primaryCollections: ExportedPrimaryCollectionData[] = JSON.parse(
    jsonData
  ) as ExportedPrimaryCollectionData[];
  const data: Partial<Product>[] = [];
  for (const primaryCollectionData of primaryCollections) {
    data.push({
      id: primaryCollectionData.productId,
      customFields: {
        primaryCollection: JSON.stringify([
          {
            channelId: defaultChannel.id,
            collectionId: primaryCollectionData.primaryCollectionId,
          } as ProductPrimaryCollection,
        ]),
      },
    });
  }
  await productRepo.save(data);
}

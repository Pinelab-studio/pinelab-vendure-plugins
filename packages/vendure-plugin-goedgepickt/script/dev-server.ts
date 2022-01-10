import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { InitialData } from '@vendure/core';
import { initialData } from '../../test/src/initial-data';
import { localConfig } from './local-config';
import { GoedgepicktService } from '../src/goedgepickt.service';

(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const { server } = createTestEnvironment(localConfig);
  await server.init({
    initialData: initialData as InitialData,
    productsCsvPath: '../test/src/products-import.csv',
  });

  // await server.app.get(GoedgepicktService).pushProducts('e2e-default-channel');
  await server.app
    .get(GoedgepicktService)
    .pullStocklevels('e2e-default-channel');
})();

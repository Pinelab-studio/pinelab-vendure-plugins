import {
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';
import { CoinbaseController, CoinbaseResolver } from './coinbase.controller';
import { coinbaseHandler } from './coinbase.handler';
import { CoinbaseService } from './coinbase.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CoinbaseController],
  providers: [CoinbaseService],
  shopApiExtensions: {
    schema: gql`
      extend type Mutation {
        createCoinbasePaymentIntent: String!
      }
    `,
    resolvers: [CoinbaseResolver],
  },
  compatibility: '^2.0.0',
  configuration: (config: RuntimeVendureConfig) => {
    config.paymentOptions.paymentMethodHandlers.push(coinbaseHandler);
    return config;
  },
})
export class CoinbasePlugin {}

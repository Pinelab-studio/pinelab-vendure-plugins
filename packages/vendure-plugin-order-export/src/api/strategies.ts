import { OrderExportConfig } from '../ui/generated/graphql';

export const strategies: OrderExportConfig[] = [
  {
    name: 'e-boekhouden',
    arguments: [
      {
        name: 'tegenrekening',
        value: '8020',
      },
      {
        name: 'username',
        value: '',
      },
      {
        name: 'secret1',
        value: '8020',
      },
      {
        name: 'secret2',
        value: undefined,
      },
    ],
  },
  {
    name: 'email',
    arguments: [],
  },
  {
    name: 'rompslomp',
    arguments: [
      {
        name: 'apiKey',
        value: undefined,
      },
    ],
  },
];

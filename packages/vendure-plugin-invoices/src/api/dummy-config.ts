import { InvoiceConfig } from '../ui/generated/graphql';
import { defaultTemplate } from './default-template';

export const dummyConfig: InvoiceConfig = {
  id: 'bla',
  enabled: true,
  templateString: defaultTemplate,
};

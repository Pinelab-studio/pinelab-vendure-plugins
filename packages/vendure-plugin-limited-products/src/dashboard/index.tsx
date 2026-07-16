import { defineDashboardExtension } from '@vendure/dashboard';
import { ChannelAwareIntCustomField } from './components/ChannelAwareIntCustomField';

defineDashboardExtension({
  customFormComponents: {
    customFields: [
      {
        id: 'channel-aware-int-form-input',
        component: ChannelAwareIntCustomField,
      },
    ],
  },
});

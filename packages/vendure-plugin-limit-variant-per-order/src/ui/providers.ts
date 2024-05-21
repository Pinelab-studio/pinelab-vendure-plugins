import { registerFormInputComponent } from '@vendure/admin-ui/core';
import { ChannelAwareIntCustomFieldComponent } from './channel-aware-int-custom-field/channel-aware-int-custom-field.component';

export default [
  registerFormInputComponent(
    'channel-aware-int-form-input',
    ChannelAwareIntCustomFieldComponent
  ),
];

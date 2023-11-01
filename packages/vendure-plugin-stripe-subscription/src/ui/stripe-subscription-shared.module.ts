import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  registerFormInputComponent,
  registerHistoryEntryComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import { HistoryEntryComponent } from './history-entry.component';

@NgModule({
  imports: [SharedModule],
  providers: [
    registerHistoryEntryComponent({
      type: 'STRIPE_SUBSCRIPTION_NOTIFICATION',
      component: HistoryEntryComponent,
    }),
  ],
})
export class StripeSubscriptionSharedModule {}

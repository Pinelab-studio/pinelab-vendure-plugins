import { addActionBarItem, SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { Observable } from 'rxjs';
import { createNewDraftOrder } from './order-state.util';
import { RouterModule } from '@angular/router';
import { take } from 'rxjs/operators';
@NgModule({
  imports: [
    SharedModule,
    RouterModule.forRoot([], { onSameUrlNavigation: 'reload' }),
  ],
  providers: [
    addActionBarItem({
      id: 'active-to-draft',
      label: 'Convert to Draft',
      buttonColor: 'success',
      buttonStyle: 'outline',
      icon: 'history',
      locationId: 'order-detail',
      routerLink: [],
      requiresPermission: 'CreateOrder',
      onClick: async (event, { route, dataService, notificationService }) => {
        const orderId = route.snapshot.params.id;
        await createNewDraftOrder(dataService, orderId);
        notificationService.success(`Successfully created a Draft order`);
      },
    }),
  ],
})
export class ConvertToDraftButtonModule {}

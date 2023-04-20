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
      disabled: new Observable<boolean>((subscriber) => {
        subscriber.next(false);
      }),
      buttonColor: 'success',
      buttonStyle: 'outline',
      icon: 'history',
      locationId: 'order-detail',
      routerLink: [],
      onClick: async (event, { route, dataService, notificationService }) => {
        try {
          const orderId = route.snapshot.params.id;
          if (await createNewDraftOrder(dataService, orderId)) {
            notificationService.success(`Successfully created a Draft order`);
          } else {
            notificationService.error(`Unable to create a Draft order`);
          }
        } catch (e) {
          notificationService.error(e.message);
          console.error(e);
        }
      },
    }),
  ],
})
export class ConvertToDraftButtonModule {}

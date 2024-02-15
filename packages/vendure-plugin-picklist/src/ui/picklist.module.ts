import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { PicklistComponent } from './picklist.component';

@NgModule({
  declarations: [PicklistComponent],
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: PicklistComponent,
        data: { breadcrumb: 'Picklists' },
      },
    ]),
  ],
})
export class PicklistModule {}

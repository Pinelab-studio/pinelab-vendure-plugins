import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { SendcloudComponent } from './sendcloud.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: SendcloudComponent,
        data: { breadcrumb: 'SendCloud' },
      },
    ]),
  ],
  providers: [],
  declarations: [SendcloudComponent],
})
export class SendcloudModule {}

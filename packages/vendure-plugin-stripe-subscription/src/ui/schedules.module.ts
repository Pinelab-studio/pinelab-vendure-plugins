import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { SchedulesComponent } from './schedules.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: SchedulesComponent,
        data: { breadcrumb: 'Subscription schedules' },
      },
    ]),
  ],
  providers: [],
  declarations: [SchedulesComponent],
})
export class SchedulesModule {}

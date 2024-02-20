import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { MyparcelComponent } from './myparcel.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: MyparcelComponent,
        data: { breadcrumb: 'MyParcel' },
      },
    ]),
  ],
  providers: [
    addNavMenuItem(
      {
        id: 'myparcel',
        label: 'MyParcel',
        routerLink: ['/extensions/myparcel'],
        icon: 'cursor-hand-open',
      },
      'settings',
    ),
  ],
  declarations: [MyparcelComponent],
})
export class MyparcelModule {}

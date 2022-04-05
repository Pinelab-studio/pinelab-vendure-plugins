import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { GoedgepicktComponent } from './goedgepickt.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: GoedgepicktComponent,
        data: { breadcrumb: 'Goedgepickt' },
      },
    ]),
  ],
  providers: [
    addNavMenuItem(
      {
        id: 'goedgepickt',
        label: 'Goedgepickt',
        routerLink: ['/extensions/goedgepickt'],
        icon: 'cursor-hand-open',
      },
      'settings'
    ),
  ],
  declarations: [GoedgepicktComponent],
})
export class GoedgepicktModule {}

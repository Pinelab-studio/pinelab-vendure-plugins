import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { Extension } from '@vendure/ui-devkit/compiler';
import { PicqerConfigComponent } from './picqer-config.component';

/**
 * Shared module for Picqer menu item and history entry component.
 */
@NgModule({
  imports: [SharedModule],
  declarations: [],
  providers: [
    addNavMenuItem(
      {
        id: 'picqer',
        label: 'Picqer',
        routerLink: ['/extensions/picqer'],
        icon: 'cloud-network',
        requiresPermission: 'Picqer',
      },
      'settings'
    ),
    /*     registerHistoryEntryComponent({
          type: 'GOEDGEPICKT_NOTIFICATION',
          component: HistoryEntryComponent,
        }), */
  ],
})
export class PicqerSharedModule {}

/**
 * Lazy module for Picqer configuration page.
 */
@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: PicqerConfigComponent,
        data: { breadcrumb: 'Picqer' },
      },
    ]),
  ],
  declarations: [PicqerConfigComponent],
})
export class PicqerLazyModule {}

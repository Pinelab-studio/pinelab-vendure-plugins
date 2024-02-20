import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'e-boekhouden',
        label: 'e-Boekhouden',
        routerLink: ['/extensions/e-boekhouden'],
        icon: 'dollar-bill',
        requiresPermission: 'eBoekhouden',
      },
      'settings',
    ),
  ],
})
export class EBoekhoudenNavModule {}

import { NgModule, isDevMode } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { TestContentComponent } from './test-content-component';
import { ContentComponentRegistryService } from './content-component-registry.service';
import { PinelabPluginAdminComponentsComponent } from './pinelab-plugin-admin-components.component';

@NgModule({
  declarations: [TestContentComponent, PinelabPluginAdminComponentsComponent],
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: PinelabPluginAdminComponentsComponent,
        data: { breadcrumb: 'Invoices' },
      },
    ]),
  ],
  providers: [ContentComponentRegistryService],
})
export class PinelabPluinAdminComponentsModule {
  constructor(
    private contentComponentRegistryService: ContentComponentRegistryService
  ) {
    if (isDevMode()) {
      this.contentComponentRegistryService.registerContentComponent(
        TestContentComponent
      );
    }
  }
}

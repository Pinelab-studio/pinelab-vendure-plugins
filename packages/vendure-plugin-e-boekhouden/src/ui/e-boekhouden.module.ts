import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { EBoekhoudenComponent } from "./e-boekhouden.component";

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: EBoekhoudenComponent,
        data: { breadcrumb: 'e-Boekhouden' },
      },
    ]),
  ],
  providers: [],
  declarations: [EBoekhoudenComponent],
})
export class EBoekhoudenModule {}

import { NgModule } from '@angular/core';
import {
  SharedModule,
  registerFormInputComponent,
} from '@vendure/admin-ui/core';
import { SelectPrimaryCollectionComponent } from './select-primary-collection.component';

@NgModule({
  imports: [SharedModule],
  declarations: [SelectPrimaryCollectionComponent],
  providers: [
    registerFormInputComponent(
      'select-primary-collection',
      SelectPrimaryCollectionComponent
    ),
  ],
})
export class PrimaryCollectionSharedExtensionModule {}

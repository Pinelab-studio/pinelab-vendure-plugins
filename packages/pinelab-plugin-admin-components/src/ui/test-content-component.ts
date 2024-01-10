import { Component } from '@angular/core';
import { ContentComponentRegistryService } from './content-component-registry.service';
@Component({
  template: `<h3>Your Invoice content goes here</h3>`,
  providers: [ContentComponentRegistryService],
})
export class TestContentComponent {}

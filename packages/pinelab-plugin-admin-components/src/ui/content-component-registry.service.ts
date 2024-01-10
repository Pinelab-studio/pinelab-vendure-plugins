import { Injectable } from '@angular/core';
@Injectable({
  providedIn: 'root',
})
export class ContentComponentRegistryService {
  private innerComponent: any;

  registerContentComponent(component: any) {
    this.innerComponent = component;
  }

  getContentComponent(): any | undefined {
    return this.innerComponent;
  }
}

export const extensionRoutes = [  {
    path: 'extensions/webhook',
    loadChildren: () => import('./extensions/0ba12bdc21d0badf1b382da3f73aa16c1ed24d19dc7e5e997998a1d25cf9b9c9/webhook.module').then(m => m.WebhookModule),
  }];

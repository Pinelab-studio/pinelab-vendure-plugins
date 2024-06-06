// Icons are from https://handcrafts.undraw.co/app and set the color to #05C787
// But, most of them should already be in public/icons, along with some others
const icons: Record<string, string> = {
  'vendure-plugin-invoices': 'sticky-note.svg',
  'vendure-plugin-google-storage-assets': 'google.png',
  'vendure-plugin-facet-suggestions': 'undraw_chat-text.svg',
  'vendure-plugin-stripe-subscription': 'stripe.webp',
  'vendure-plugin-multiserver-db-sessioncache':
    'undraw_asymmetric-parallels.svg',
  'vendure-plugin-sendcloud': 'sendcloud.svg',
  'vendure-plugin-shipping-extensions': 'undraw_envelope.svg',
  'vendure-plugin-google-cloud-tasks': 'google.png',
  'vendure-plugin-order-export': 'undraw_cloud-download.svg',
  'vendure-plugin-webhook': 'undraw_fun-arrow.svg',
  'vendure-plugin-admin-ui-helpers': 'undraw_person.svg',
  'vendure-plugin-metrics': 'undraw_bar-chart.svg',
  'vendure-plugin-modify-customer-orders': 'undraw_screen-pointer.svg',
  'vendure-plugin-primary-collection': 'undraw_fun-underline.svg',
  // TODO add all
};

export function getIcon(pluginName: string): string {
  const icon = icons[pluginName];
  return `/icons/${icon ?? 'undraw_cupcake.svg'}`;
}

// Icons are from https://handcrafts.undraw.co/app and set the color to #05C787
// But, most of them should already be in public/icons, along with some others
const icons: Record<string, string> = {
  'pinelab-invoice-plugin': 'sticky-note.svg',
  'pinelab-frequently-bought-together-plugin': 'undraw_arrow.svg',
  'vendure-plugin-google-storage-assets': 'google_cloud.png',
  'vendure-plugin-facet-suggestions': 'undraw_chat-text.svg',
  'vendure-plugin-stripe-subscription': 'stripe.webp',
  'vendure-plugin-multiserver-db-sessioncache':
    'undraw_asymmetric-parallels.svg',
  'vendure-plugin-sendcloud': 'sendcloud.svg',
  'vendure-plugin-shipping-extensions': 'undraw_envelope.svg',
  'vendure-plugin-google-cloud-tasks': 'google_cloud.png',
  'vendure-plugin-order-export': 'undraw_cloud-download.svg',
  'vendure-plugin-webhook': 'undraw_fun-arrow.svg',
  'vendure-plugin-admin-ui-helpers': 'undraw_person.svg',
  'vendure-plugin-metrics': 'undraw_bar-chart.svg',
  'vendure-plugin-modify-customer-orders': 'undraw_screen-pointer.svg',
  'vendure-plugin-primary-collection': 'undraw_fun-underline.svg',
  'vendure-plugin-stock-monitoring': 'undraw_alarm-clock.svg',
  'vendure-plugin-picqer': 'picqer.png',
  'vendure-plugin-popularity-scores': 'undraw_star.svg',
  'vendure-plugin-admin-social-auth': 'google.png',
  'vendure-plugin-accept-blue': 'accept-blue.jpeg',
  'vendure-plugin-selectable-gifts': 'undraw_balloon.svg',
  'vendure-plugin-customer-managed-groups': 'undraw_person.svg',
  'vendure-plugin-goedgepickt': 'goedgepickt.png',
  'vendure-plugin-variant-bulk-update': 'undraw_chevrons.svg',
  'vendure-plugin-dutch-postalcode': 'undraw_asymmetric-lines.svg',
  'vendure-plugin-order-pdfs': 'undraw_note.svg',
  'vendure-plugin-anonymized-order': 'undraw_ghost.svg',
  'vendure-plugin-limit-variant-per-order': 'undraw_circled-x.svg',
  'vendure-plugin-myparcel': 'myparcel.png',
  'vendure-plugin-e-boekhouden': 'e-boekhouden.png',
  'vendure-plugin-coinbase': 'coinbase.png',
  'vendure-plugin-public-customer-groups': 'undraw_camera.svg',
  'vendure-plugin-shipmate': 'shipmate.jpg',
  'vendure-plugin-klaviyo': 'klaviyo.png',
  'vendure-plugin-payment-extensions': 'undraw_check.svg',
  'vendure-plugin-campaign-tracker': 'undraw_dashed-arrow.svg',
};

export function getIcon(pluginName: string): string {
  const icon = icons[pluginName];
  return `/icons/${icon ?? 'undraw_cupcake.svg'}`;
}

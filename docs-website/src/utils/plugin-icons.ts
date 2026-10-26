import type { ComponentProps } from 'astro/types';
import { Icon } from '@astrojs/starlight/components';

type PluginVisual = {
  icon: ComponentProps<typeof Icon>['name'];
  color: string;
  logo?: string;
};

/** Icon and brand-color choices for every plugin, keyed by its public slug. */
export const pluginIcons: Record<string, PluginVisual> = {
  'pinelab-frequently-bought-together-plugin': {
    icon: 'puzzle',
    color: '#a78bfa',
  },
  'pinelab-invoice-plugin': { icon: 'document', color: '#60a5fa' },
  'remote-asset-downloader': { icon: 'cloud-download', color: '#38bdf8' },
  'vendure-plugin-accept-blue': {
    icon: 'approve-check',
    color: '#60a5fa',
    logo: 'accept-blue.jpeg',
  },
  'vendure-plugin-address-lookup': { icon: 'magnifier', color: '#34d399' },
  'vendure-plugin-admin-social-auth': { icon: 'padlock', color: '#a78bfa' },
  'vendure-plugin-admin-ui-helpers': { icon: 'window', color: '#38bdf8' },
  'vendure-plugin-alerting': { icon: 'warning', color: '#fbbf24' },
  'vendure-plugin-anonymized-order': { icon: 'padlock', color: '#94a3b8' },
  'vendure-plugin-better-search': { icon: 'magnifier', color: '#38bdf8' },
  'vendure-plugin-coinbase': {
    icon: 'database',
    color: '#60a5fa',
    logo: 'coinbase.png',
  },
  'vendure-plugin-content-automation': { icon: 'rocket', color: '#c084fc' },
  'vendure-plugin-content-health': { icon: 'heart', color: '#fb7185' },
  'vendure-plugin-customer-managed-groups': {
    icon: 'list-format',
    color: '#a78bfa',
  },
  'vendure-plugin-drop-off-points': { icon: 'random', color: '#34d399' },
  'vendure-plugin-e-boekhouden': {
    icon: 'document',
    color: '#fbbf24',
    logo: 'e-boekhouden.png',
  },
  'vendure-plugin-facet-suggestions': { icon: 'star', color: '#fbbf24' },
  'vendure-plugin-goedgepickt': {
    icon: 'approve-check',
    color: '#fb923c',
    logo: 'goedgepickt.png',
  },
  'vendure-plugin-google-cloud-tasks': {
    icon: 'server',
    color: '#60a5fa',
    logo: 'google_cloud.png',
  },
  'vendure-plugin-google-sheet-loader': {
    icon: 'list-format',
    color: '#34d399',
    logo: 'google-sheet.png',
  },
  'vendure-plugin-google-storage-assets': {
    icon: 'database',
    color: '#60a5fa',
    logo: 'google_cloud.png',
  },
  'vendure-plugin-klaviyo': {
    icon: 'email',
    color: '#fb923c',
    logo: 'klaviyo.png',
  },
  'vendure-plugin-limited-products': { icon: 'clock', color: '#fbbf24' },
  'vendure-plugin-metrics': { icon: 'analytics', color: '#38bdf8' },
  'vendure-plugin-modify-customer-orders': { icon: 'pencil', color: '#fb923c' },
  'vendure-plugin-multiserver-db-sessioncache': {
    icon: 'server',
    color: '#a78bfa',
  },
  'vendure-plugin-myparcel': {
    icon: 'random',
    color: '#fb923c',
    logo: 'myparcel.png',
  },
  'vendure-plugin-order-cleanup': {
    icon: 'approve-check-circle',
    color: '#34d399',
  },
  'vendure-plugin-order-export': { icon: 'download', color: '#38bdf8' },
  'vendure-plugin-order-pdfs': { icon: 'document', color: '#fb7185' },
  'vendure-plugin-payment-extensions': { icon: 'puzzle', color: '#34d399' },
  'vendure-plugin-picqer': {
    icon: 'database',
    color: '#fb7185',
    logo: 'picqer.png',
  },
  'vendure-plugin-popularity-scores': { icon: 'star', color: '#fbbf24' },
  'vendure-plugin-primary-collection': {
    icon: 'list-format',
    color: '#a78bfa',
  },
  'vendure-plugin-promotion-extensions': { icon: 'star', color: '#fb7185' },
  'vendure-plugin-public-customer-groups': {
    icon: 'list-format',
    color: '#60a5fa',
  },
  'vendure-plugin-qls-fulfillment': {
    icon: 'random',
    color: '#34d399',
    logo: 'qls.webp',
  },
  'vendure-plugin-selectable-gifts': { icon: 'heart', color: '#fb7185' },
  'vendure-plugin-sendcloud': {
    icon: 'cloud-download',
    color: '#60a5fa',
    logo: 'sendcloud.svg',
  },
  'vendure-plugin-shipmate': {
    icon: 'random',
    color: '#fb923c',
    logo: 'shipmate.jpg',
  },
  'vendure-plugin-shipping-extensions': { icon: 'random', color: '#38bdf8' },
  'vendure-plugin-simple-cms': { icon: 'pencil', color: '#c084fc' },
  'vendure-plugin-stock-monitoring': { icon: 'analytics', color: '#fbbf24' },
  'vendure-plugin-store-credit': { icon: 'heart', color: '#34d399' },
  'vendure-plugin-stripe-subscription': {
    icon: 'clock',
    color: '#a78bfa',
    logo: 'stripe.webp',
  },
  'vendure-plugin-utm-tracker': { icon: 'analytics', color: '#fb923c' },
  'vendure-plugin-validate-cart': {
    icon: 'approve-check-circle',
    color: '#34d399',
  },
  'vendure-plugin-variant-bulk-update': { icon: 'pencil', color: '#60a5fa' },
  'vendure-plugin-webhook': { icon: 'link', color: '#c084fc' },
  'vendure-scripts': { icon: 'forward-slash', color: '#94a3b8' },
};

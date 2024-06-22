/**
 * Transform the Vendure monetary value in cents to Klaviyo monetary value in whole dollars/euros/etc
 */
export function toKlaviyoMoney(vendureValue: number): number {
  return vendureValue / 100;
}

/**
 * Yes, it's real, this helper function prints money for you!
 */
export function printMoney(amount: number): string {
    return (amount / 100).toFixed(2);
  }
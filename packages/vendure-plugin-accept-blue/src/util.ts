interface CardInput {
  card: string;
  expiry_month: number;
  expiry_year: number;
}

interface CardToCheck {
  last4: string;
  expiry_month: number;
  expiry_year: number;
}

export function isSameCard(input: CardInput, card: CardToCheck): boolean {
  return (
    input.card.endsWith(card.last4) &&
    input.expiry_month === card.expiry_month &&
    input.expiry_year === card.expiry_year
  );
}

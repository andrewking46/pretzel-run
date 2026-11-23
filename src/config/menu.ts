// Prices and order tiers. All money is integer cents.

export const TAX_RATE = 0.08875; // NYC combined sales tax
export const TAX_LABEL = 'NYC tax 8.875%';

export const ITEMS = {
  original: { name: 'Original Pretzel', price: 549 },
  lemonade: { name: 'Original Lemonade', price: 479 },
  cinnamon: { name: 'Cinnamon Sugar Pretzel', price: 579 },
  nuggets: { name: 'Pretzel Nuggets', price: 729 },
} as const;

export type ItemId = keyof typeof ITEMS;

export interface TierOrder {
  stars: 1 | 2 | 3;
  name: string;
  items: readonly { id: ItemId; qty: number }[];
}

export const ORDERS: readonly TierOrder[] = [
  { stars: 1, name: 'The Original', items: [{ id: 'original', qty: 1 }] },
  { stars: 2, name: 'Pretzel + Lemonade', items: [{ id: 'original', qty: 1 }, { id: 'lemonade', qty: 1 }] },
  {
    stars: 3,
    name: "Alex's Usual",
    items: [
      { id: 'original', qty: 2 },
      { id: 'cinnamon', qty: 1 },
      { id: 'nuggets', qty: 1 },
      { id: 'lemonade', qty: 1 },
    ],
  },
];

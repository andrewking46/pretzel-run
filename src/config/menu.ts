// Prices and order tiers. All money is integer cents.

export const TAX_RATE = 0.08875; // NYC combined sales tax
export const TAX_LABEL = 'NYC tax 8.875%';

/** In the order they print on a receipt. `short` is the register's abbreviation, used in the shared text. */
export const ITEMS = {
  original: { name: 'Original Pretzel', short: 'Original', price: 549 },
  cinnamon: { name: 'Cinnamon Sugar Pretzel', short: 'Cinnamon', price: 579 },
  nuggets: { name: 'Pretzel Nuggets', short: 'Nuggets', price: 729 },
  dog: { name: 'Pretzel Dog', short: 'Pretzel Dog', price: 649 },
  lemonade: { name: 'Original Lemonade', short: 'Lemonade', price: 479 },
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

/** Cash left over after Alex's Usual buys one more thing at a time, in this order, round and round. */
export const EXTRAS: readonly ItemId[] = ['dog', 'original', 'nuggets', 'lemonade', 'cinnamon'];

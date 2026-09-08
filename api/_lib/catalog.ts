export type ServerProduct = {
  id: string;
  name: string;
  type: "original" | "print";
  priceInCents: number;
  stripePriceId?: string;
  sold: boolean;
  inventory: number | null;
  variants?: {
    id: string;
    name: string;
    priceInCents: number;
    stripePriceId?: string;
  }[];
};

// TODO: Replace every placeholder Stripe Price ID after creating prices in Stripe.
// These values never ship in the browser bundle. Product IDs must match src/data/products.ts.
export const serverProducts: ServerProduct[] = [
  {
    id: "original-golden-hour",
    name: "Golden Hour Study",
    type: "original",
    priceInCents: 85000,
    stripePriceId: process.env.STRIPE_PRICE_GOLDEN_HOUR,
    inventory: 1,
    sold: false,
  },
  {
    id: "original-still-water",
    name: "Still Water",
    type: "original",
    priceInCents: 62000,
    stripePriceId: process.env.STRIPE_PRICE_STILL_WATER,
    inventory: 1,
    sold: false,
  },
  {
    id: "print-wild-flowers",
    name: "Wild Flowers",
    type: "print",
    priceInCents: 4500,
    inventory: null,
    sold: false,
    variants: [
      {
        id: "8x10",
        name: "8 × 10 in",
        priceInCents: 4500,
        stripePriceId: process.env.STRIPE_PRICE_WILD_FLOWERS_8X10,
      },
      {
        id: "16x20",
        name: "16 × 20 in",
        priceInCents: 8500,
        stripePriceId: process.env.STRIPE_PRICE_WILD_FLOWERS_16X20,
      },
      {
        id: "24x30",
        name: "24 × 30 in",
        priceInCents: 14500,
        stripePriceId: process.env.STRIPE_PRICE_WILD_FLOWERS_24X30,
      },
    ],
  },
  {
    id: "print-blue-morning",
    name: "Blue Morning",
    type: "print",
    priceInCents: 4500,
    inventory: null,
    sold: false,
    variants: [
      {
        id: "8x10",
        name: "8 × 10 in",
        priceInCents: 4500,
        stripePriceId: process.env.STRIPE_PRICE_BLUE_MORNING_8X10,
      },
      {
        id: "16x20",
        name: "16 × 20 in",
        priceInCents: 8500,
        stripePriceId: process.env.STRIPE_PRICE_BLUE_MORNING_16X20,
      },
    ],
  },
];

export const serverProductById = (id: string) =>
  serverProducts.find((product) => product.id === id);
export const catalogItemByPrice = (priceId: string) => {
  for (const product of serverProducts) {
    if (product.stripePriceId === priceId)
      return { product, variant: undefined };
    const variant = product.variants?.find(
      (entry) => entry.stripePriceId === priceId,
    );
    if (variant) return { product, variant };
  }
};

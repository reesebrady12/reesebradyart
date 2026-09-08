import type { Product } from "../types";

// TODO: Replace this sample catalog with your artwork details and image filenames.
// Keep matching IDs in api/_lib/catalog.ts, where private Stripe Price IDs live.
export const products: Product[] = [
  {
    id: "original-golden-hour",
    slug: "golden-hour-study",
    name: "Golden Hour Study",
    description:
      "A quiet study of late-afternoon light moving across an open landscape.",
    image: "/art/golden-hour.svg",
    type: "original",
    category: "available",
    purchasable: true,
    priceInCents: 85000,
    inventory: 1,
    sold: false,
    dimensions: "24 × 30 in",
    medium: "oil",
    completionYear: 2026,
    year: 2026,
    featured: true,
  },
  {
    id: "original-still-water",
    slug: "still-water",
    name: "Still Water",
    description:
      "Soft color, reflected sky, and the calm geometry of the shoreline.",
    image: "/art/still-water.svg",
    type: "original",
    category: "available",
    purchasable: true,
    priceInCents: 62000,
    inventory: 1,
    sold: false,
    dimensions: "18 × 24 in",
    medium: "oil",
    completionYear: 2025,
    year: 2025,
  },
  {
    id: "print-wild-flowers",
    slug: "wild-flowers-print",
    name: "Wild Flowers",
    description:
      "An archival fine-art print made from the original floral study.",
    image: "/art/wild-flowers.svg",
    type: "print",
    category: "available",
    purchasable: true,
    priceInCents: 4500,
    inventory: null,
    sold: false,
    medium: "Archival pigment print",
    variants: [
      { id: "8x10", name: "8 × 10 in", priceInCents: 4500 },
      { id: "16x20", name: "16 × 20 in", priceInCents: 8500 },
      { id: "24x30", name: "24 × 30 in", priceInCents: 14500 },
    ],
  },
  {
    id: "print-blue-morning",
    slug: "blue-morning-print",
    name: "Blue Morning",
    description:
      "A museum-quality print celebrating the cool stillness just before sunrise.",
    image: "/art/blue-morning.svg",
    type: "print",
    category: "available",
    purchasable: true,
    priceInCents: 4500,
    inventory: null,
    sold: false,
    medium: "Archival pigment print",
    variants: [
      { id: "8x10", name: "8 × 10 in", priceInCents: 4500 },
      { id: "16x20", name: "16 × 20 in", priceInCents: 8500 },
    ],
  },
];

export const getProduct = (id: string) =>
  products.find((product) => product.id === id);
export const getProductBySlug = (slug: string) =>
  products.find((product) => product.slug === slug);

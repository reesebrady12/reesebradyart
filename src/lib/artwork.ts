import type { Product } from "../types";

export const artworkCategories = [
  { value: "available", label: "Available for Sale", publicLabel: "Available" },
  { value: "sold", label: "Sold Artwork", publicLabel: "Sold" },
  { value: "project", label: "Other Project", publicLabel: "Projects" },
] as const;

export const artworkMediums = [
  { value: "oil", label: "Oil" },
  { value: "colored_pencil", label: "Colored Pencil" },
  { value: "graphite_pencil", label: "Graphite Pencil" },
] as const;

export const mediumLabel = (value?: string) =>
  artworkMediums.find((medium) => medium.value === value)?.label ?? value ?? "";

export const canPurchase = (product: Product) =>
  product.category === "available" &&
  product.purchasable &&
  !product.sold &&
  product.inventory !== 0 &&
  product.priceInCents > 0;

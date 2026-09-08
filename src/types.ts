export type ProductType = "original" | "print";

export type ProductVariant = {
  id: string;
  name: string;
  priceInCents: number;
  inventory?: number | null;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  additionalImages?: string[];
  images?: {
    id: string;
    url: string;
    thumbnailUrl: string;
    largeUrl: string;
    masterUrl: string;
    alt: string;
    type: string;
    width?: number;
    height?: number;
  }[];
  type: ProductType;
  category: "available" | "sold" | "project";
  purchasable: boolean;
  priceInCents: number;
  inventory: number | null;
  sold: boolean;
  dimensions?: string;
  medium?: string;
  completionDate?: string;
  completionYear?: number;
  commissioned?: boolean;
  collectionLabel?: string;
  year?: number;
  featured?: boolean;
  variants?: ProductVariant[];
};

export type CartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};

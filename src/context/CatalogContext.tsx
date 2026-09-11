import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { products as fallback } from "../data/products";
import type { Product } from "../types";
import { getArtworkPublicUrl } from "../lib/artwork-storage";

const fallbackProducts = fallback.map((product) => ({
  ...product,
  image: getArtworkPublicUrl(product.image),
}));
const catalogFallback = import.meta.env.VITE_SUPABASE_URL
  ? []
  : fallbackProducts;

type DbProduct = Record<string, unknown> & {
  painting_images?: Record<string, unknown>[];
  product_variants?: Record<string, unknown>[];
};
// Shared with the server-filtered gallery views.
// eslint-disable-next-line react-refresh/only-export-components
export const mapProduct = (row: DbProduct): Product => ({
  id: String(row.id),
  slug: String(row.slug),
  name: String(row.title),
  description: String(row.description ?? ""),
  image: getArtworkPublicUrl(
    String(
      row.painting_images?.[0]?.gallery_path ??
        row.painting_images?.[0]?.large_path ??
        row.painting_images?.[0]?.storage_path ??
        row.image ??
        "",
    ),
  ),
  additionalImages: row.painting_images
    ?.slice(1)
    .map((image) =>
      getArtworkPublicUrl(
        String(image.gallery_path ?? image.large_path ?? image.storage_path),
      ),
    ),
  images: row.painting_images?.map((image) => ({
    id: String(image.id),
    url: getArtworkPublicUrl(
      String(image.gallery_path ?? image.large_path ?? image.storage_path),
    ),
    thumbnailUrl: getArtworkPublicUrl(
      String(image.thumbnail_path ?? image.gallery_path ?? image.storage_path),
    ),
    largeUrl: getArtworkPublicUrl(
      String(image.large_path ?? image.storage_path),
    ),
    masterUrl: getArtworkPublicUrl(String(image.storage_path)),
    alt: String(image.alt_text || row.title),
    type: String(image.image_type),
    width: image.width ? Number(image.width) : undefined,
    height: image.height ? Number(image.height) : undefined,
  })),
  type: row.type as Product["type"],
  category: String(
    row.category ?? (row.sold ? "sold" : "available"),
  ) as Product["category"],
  purchasable: Boolean(
    row.purchasable ?? (!row.sold && row.status === "published"),
  ),
  priceInCents: Number(row.price_in_cents),
  inventory: row.inventory === null ? null : Number(row.inventory),
  sold: Boolean(row.sold),
  dimensions: String(row.dimensions ?? ""),
  medium: String(row.medium ?? ""),
  completionDate: row.completion_date ? String(row.completion_date) : undefined,
  completionYear: row.completion_year
    ? Number(row.completion_year)
    : row.year
      ? Number(row.year)
      : undefined,
  commissioned: Boolean(row.commissioned),
  collectionLabel: row.collection_label
    ? String(row.collection_label)
    : undefined,
  year: row.year ? Number(row.year) : undefined,
  featured: Boolean(row.featured),
  variants: row.product_variants?.map((variant) => ({
    id: String(variant.id),
    name: String(variant.name),
    priceInCents: Number(variant.price_in_cents),
    inventory: variant.inventory === null ? null : Number(variant.inventory),
  })),
});
const CatalogContext = createContext({
  products: fallbackProducts,
  loading: false,
});
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState(catalogFallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setProducts(data.products.map(mapProduct)))
      .catch(() => setProducts(catalogFallback))
      .finally(() => setLoading(false));
  }, []);
  return (
    <CatalogContext.Provider value={{ products, loading }}>
      {children}
    </CatalogContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useCatalog = () => useContext(CatalogContext);

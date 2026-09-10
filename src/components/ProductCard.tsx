import { Link } from "wouter";
import { formatCurrency } from "../lib/currency";
import type { Product } from "../types";
import { mediumLabel } from "../lib/artwork";
import { ECOMMERCE_ENABLED } from "../config/features";

export function ProductCard({ product }: { product: Product }) {
  const startingPrice =
    product.variants?.[0]?.priceInCents ?? product.priceInCents;
  return (
    <article className="product-card">
      <Link className="artwork-frame" href={`/work/${product.slug}`}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.category === "sold" && (
          <span className="sold-badge">Sold</span>
        )}
      </Link>
      <div className="product-card-info">
        <div>
          <p className="eyebrow">
            {[
              mediumLabel(product.medium),
              product.completionYear ?? product.year,
            ]
              .filter(Boolean)
              .join(" · ") ||
              (product.type === "original" ? "Original" : "Fine-art print")}
          </p>
          <h2>
            <Link href={`/work/${product.slug}`}>{product.name}</Link>
          </h2>
          {product.dimensions && (
            <p className="card-dimensions">{product.dimensions}</p>
          )}
        </div>
        {(product.category === "sold" ||
          (ECOMMERCE_ENABLED && product.category === "available")) && (
          <p>
            {product.category === "sold"
              ? product.collectionLabel || "Sold"
              : `${product.variants ? "From " : ""}${formatCurrency(startingPrice)}`}
          </p>
        )}
      </div>
    </article>
  );
}

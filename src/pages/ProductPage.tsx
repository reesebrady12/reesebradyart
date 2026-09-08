import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { formatCurrency } from "../lib/currency";
import { canPurchase, mediumLabel } from "../lib/artwork";
import { mapProduct } from "../context/CatalogContext";
import type { Product } from "../types";

export function ProductPage() {
  const { slug } = useParams();
  const { products } = useCatalog();
  const catalogProduct = products.find((item) => item.slug === slug);
  const [loadedProduct, setLoadedProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(!catalogProduct);
  const product = catalogProduct ?? loadedProduct;
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(product?.variants?.[0]?.id);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (catalogProduct || !slug) return;
    fetch(`/api/catalog?slug=${encodeURIComponent(slug)}`)
      .then((response) => response.json())
      .then((data) =>
        setLoadedProduct(
          data.products?.[0] ? mapProduct(data.products[0]) : null,
        ),
      )
      .finally(() => setLoadingProduct(false));
  }, [catalogProduct, slug]);

  useEffect(() => {
    if (!viewerOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [viewerOpen]);

  if (loadingProduct)
    return <section className="message-page">Loading artwork…</section>;
  if (!product)
    return (
      <section className="message-page">
        <p className="eyebrow">404</p>
        <h1>Artwork not found.</h1>
        <Link href="/">Return to the shop</Link>
      </section>
    );
  const effectiveVariantId = variantId ?? product.variants?.[0]?.id;
  const selectedVariant = product.variants?.find(
    (variant) => variant.id === effectiveVariantId,
  );
  const price = selectedVariant?.priceInCents ?? product.priceInCents;
  const currentImage = product.images?.[activeImage];
  const purchaseAllowed = canPurchase(product);

  const handleAdd = () => {
    addItem(product.id, effectiveVariantId);
    setAdded(true);
  };

  return (
    <section className="product-page">
      <div className="product-gallery">
        <div className="product-image">
          <button
            type="button"
            className="zoom-image-button"
            onClick={() => setViewerOpen(true)}
            aria-label="Open high-resolution artwork image"
          >
            <img
              src={currentImage?.url ?? product.image}
              alt={currentImage?.alt ?? product.name}
              width={currentImage?.width}
              height={currentImage?.height}
            />
          </button>
          {product.category === "sold" && (
            <span className="sold-badge">Sold</span>
          )}
          {(product.images?.length ?? 0) > 1 && (
            <>
              <button
                className="gallery-arrow previous"
                aria-label="Previous image"
                onClick={() =>
                  setActiveImage(
                    (activeImage - 1 + product.images!.length) %
                      product.images!.length,
                  )
                }
              >
                ←
              </button>
              <button
                className="gallery-arrow next"
                aria-label="Next image"
                onClick={() =>
                  setActiveImage((activeImage + 1) % product.images!.length)
                }
              >
                →
              </button>
            </>
          )}
        </div>
        {(product.images?.length ?? 0) > 1 && (
          <div className="gallery-thumbnails" aria-label="Artwork images">
            {product.images!.map((image, index) => (
              <button
                className={activeImage === index ? "active" : ""}
                key={image.id}
                onClick={() => setActiveImage(index)}
                aria-label={`View ${image.type} image`}
              >
                <img
                  src={image.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  width={image.width}
                  height={image.height}
                />
              </button>
            ))}
          </div>
        )}
      </div>
      {viewerOpen && (
        <div
          className="artwork-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="High-resolution artwork view"
          onClick={() => setViewerOpen(false)}
        >
          <button type="button" onClick={() => setViewerOpen(false)}>
            Close
          </button>
          <img
            src={currentImage?.largeUrl ?? product.image}
            alt={currentImage?.alt ?? product.name}
            onClick={(event) => event.stopPropagation()}
          />
          {currentImage?.masterUrl && (
            <a
              href={currentImage.masterUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              View master resolution
            </a>
          )}
        </div>
      )}
      <div className="product-details">
        <p className="eyebrow">
          {product.category === "project"
            ? "Portfolio project"
            : product.category === "sold"
              ? product.commissioned
                ? "Commissioned artwork"
                : "Collected work"
              : product.type === "original"
                ? "Original painting"
                : "Fine-art print"}
        </p>
        <h1>{product.name}</h1>
        {product.category === "available" && (
          <p className="price">
            {purchaseAllowed ? formatCurrency(price) : "Unavailable"}
          </p>
        )}
        {product.category === "sold" && (
          <p className="price portfolio-status">
            {product.collectionLabel || "Sold"}
          </p>
        )}
        <p className="description">{product.description}</p>
        <dl>
          {product.medium && (
            <>
              <dt>Medium</dt>
              <dd>{mediumLabel(product.medium)}</dd>
            </>
          )}
          {product.dimensions && (
            <>
              <dt>Dimensions</dt>
              <dd>{product.dimensions}</dd>
            </>
          )}
          {(product.completionYear || product.year) && (
            <>
              <dt>Year</dt>
              <dd>{product.completionYear || product.year}</dd>
            </>
          )}
        </dl>
        {purchaseAllowed && product.variants && (
          <label className="field-label">
            Size
            <select
              value={effectiveVariantId}
              onChange={(event) => {
                setVariantId(event.target.value);
                setAdded(false);
              }}
            >
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} — {formatCurrency(variant.priceInCents)}
                </option>
              ))}
            </select>
          </label>
        )}
        {purchaseAllowed && (
          <button className="primary-button" onClick={handleAdd}>
            {added ? "Added to cart" : "Add to cart"}
          </button>
        )}
        {purchaseAllowed && added && (
          <Link className="text-link" href="/cart">
            View cart
          </Link>
        )}
        {purchaseAllowed && (
          <p className="fine-print">
            Secure checkout · Shipping calculated at checkout
          </p>
        )}
      </div>
    </section>
  );
}

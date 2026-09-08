import { useState } from "react";
import { Link } from "wouter";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { formatCurrency } from "../lib/currency";

export function CartPage() {
  const { items, subtotal, removeItem, updateQuantity } = useCart();
  const { products } = useCatalog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkout = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(data.error ?? "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Checkout could not be started.",
      );
      setLoading(false);
    }
  };

  if (!items.length)
    return (
      <section className="message-page">
        <p className="eyebrow">Your cart</p>
        <h1>Your cart is empty.</h1>
        <p>Take another look through the available work.</p>
        <Link className="primary-button link-button" href="/">
          Browse the collection
        </Link>
      </section>
    );

  return (
    <section className="cart-page">
      <div className="section-heading">
        <h1>Your cart</h1>
        <p>
          {items.length} {items.length === 1 ? "selection" : "selections"}
        </p>
      </div>
      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => {
            const product = products.find(
              (entry) => entry.id === item.productId,
            );
            if (!product) return null;
            const variant = product.variants?.find(
              (entry) => entry.id === item.variantId,
            );
            return (
              <article
                className="cart-item"
                key={`${item.productId}:${item.variantId}`}
              >
                <img src={product.image} alt="" />
                <div>
                  <p className="eyebrow">{product.type}</p>
                  <h2>
                    <Link href={`/work/${product.slug}`}>{product.name}</Link>
                  </h2>
                  {variant && <p>{variant.name}</p>}
                  <button
                    className="remove-button"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    Remove
                  </button>
                </div>
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity for ${product.name}`}
                    type="number"
                    min="1"
                    max={product.type === "original" ? 1 : 99}
                    disabled={product.type === "original"}
                    value={item.quantity}
                    onChange={(event) =>
                      updateQuantity(
                        item.productId,
                        item.variantId,
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
                <p className="line-price">
                  {formatCurrency(
                    (variant?.priceInCents ?? product.priceInCents) *
                      item.quantity,
                  )}
                </p>
              </article>
            );
          })}
        </div>
        <aside className="cart-summary">
          <h2>Summary</h2>
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <p>Shipping and tax are calculated securely by Stripe at checkout.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            disabled={loading}
            onClick={checkout}
          >
            {loading ? "Opening secure checkout…" : "Proceed to checkout"}
          </button>
          <p className="fine-print">
            Payments are securely processed by Stripe.
          </p>
        </aside>
      </div>
    </section>
  );
}

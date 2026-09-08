import { ProductCard } from "../components/ProductCard";
import { useCatalog } from "../context/CatalogContext";

export function ShopPage() {
  const { products, loading } = useCatalog();
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Original work by Reese Brady</p>
        <h1>Paintings for quiet spaces.</h1>
        <p className="hero-copy">
          A collection of original paintings and archival prints, made slowly
          and offered in small editions.
        </p>
      </section>
      <section className="shop-section" aria-labelledby="collection-heading">
        <div className="section-heading">
          <h2 id="collection-heading">Available work</h2>
          <p>{products.length} pieces</p>
        </div>
        {loading ? (
          <p className="collection-loading">Loading available work…</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

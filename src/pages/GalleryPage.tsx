import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ProductCard } from "../components/ProductCard";
import { mapProduct } from "../context/CatalogContext";
import { artworkMediums } from "../lib/artwork";
import type { Product } from "../types";

type Category = "available" | "sold" | "project";
const copy = {
  available: {
    eyebrow: "Current gallery",
    title: "Available artwork",
    description: "Original work currently available to collect.",
    empty: "No available works match these filters.",
  },
  sold: {
    eyebrow: "Past work",
    title: "Sold artwork",
    description: "Commissions, collected paintings, and earlier work.",
    empty: "No sold works match these filters.",
  },
  project: {
    eyebrow: "Studies and experiments",
    title: "Other projects",
    description: "Personal, academic, and exploratory work beyond the shop.",
    empty: "No projects match these filters.",
  },
};

export function GalleryPage({ category }: { category: Category }) {
  const [location, navigate] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const medium = params.get("medium") ?? "";
  const year = params.get("year") ?? "";
  const sort = params.get("sort") ?? "newest";

  useEffect(() => {
    const request = new URLSearchParams({ category });
    if (medium) request.set("medium", medium);
    if (year) request.set("year", year);
    if (sort !== "newest") request.set("sort", sort);
    fetch(`/api/catalog?${request}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("The gallery could not be loaded.");
        return response.json();
      })
      .then((data) => {
        setProducts(data.products.map(mapProduct));
        setYears(data.years.map(Number));
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "The gallery could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [category, location, medium, sort, year]);

  const update = (key: string, value: string) => {
    setLoading(true);
    setError("");
    const next = new URLSearchParams(window.location.search);
    if (value && value !== "newest") next.set(key, value);
    else next.delete(key);
    navigate(`${window.location.pathname}${next.size ? `?${next}` : ""}`);
  };
  const clear = () => {
    setLoading(true);
    setError("");
    navigate(window.location.pathname);
  };
  const content = copy[category];

  return (
    <>
      <section className="gallery-intro">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </section>
      <section className="gallery-collection" aria-labelledby="gallery-heading">
        <div className="gallery-toolbar">
          <h2 id="gallery-heading">{products.length} works</h2>
          <div className="gallery-filters">
            <label>
              Medium
              <select
                value={medium}
                onChange={(event) => update("medium", event.target.value)}
              >
                <option value="">All mediums</option>
                {artworkMediums.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time
              <select
                value={year}
                onChange={(event) => update("year", event.target.value)}
              >
                <option value="">All</option>
                <option value="this">This Year</option>
                <option value="previous">Previous Year</option>
                <option value="older">Older</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(event) => update("sort", event.target.value)}
              >
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
                {category === "available" && (
                  <option value="price_low">Price: Low to High</option>
                )}
                {category === "available" && (
                  <option value="price_high">Price: High to Low</option>
                )}
              </select>
            </label>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="collection-loading">Loading artwork…</p>
        ) : products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="gallery-empty">
            <p>{content.empty}</p>
            {(medium || year || sort !== "newest") && (
              <button type="button" onClick={clear}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

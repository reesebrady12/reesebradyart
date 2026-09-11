import { useEffect, useMemo, useState } from "react";
import { mapProduct, useCatalog } from "../../context/CatalogContext";
import type { Product } from "../../types";
import { ArtworkShowcaseItem } from "./ArtworkShowcaseItem";
import { HomeNavigation } from "../HomeNavigation";

const timestamp = (artwork: Product) => {
  if (artwork.completionDate) {
    const value = Date.parse(`${artwork.completionDate}T00:00:00Z`);
    if (Number.isFinite(value)) return value;
  }
  const year = artwork.completionYear ?? artwork.year;
  return year ? Date.UTC(year, 0, 1) : Number.NEGATIVE_INFINITY;
};

export function HomePortfolio() {
  const { products: available, loading: availableLoading } = useCatalog();
  const [additional, setAdditional] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(
      ["sold", "project"].map((category) =>
        fetch(`/api/catalog?category=${category}`).then(async (response) => {
          if (!response.ok)
            throw new Error("The portfolio could not be loaded.");
          const data = await response.json();
          return Array.isArray(data.products)
            ? data.products.map(mapProduct)
            : [];
        }),
      ),
    )
      .then((groups) => {
        if (active) setAdditional(groups.flat());
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "The portfolio could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const { featured, remaining } = useMemo(() => {
    const unique = new Map<string, Product>();
    [...available, ...additional].forEach((artwork) =>
      unique.set(artwork.id, artwork),
    );
    const artworks = [...unique.values()].sort(
      (first, second) =>
        timestamp(second) - timestamp(first) ||
        first.name.localeCompare(second.name),
    );
    return {
      featured: artworks.filter((artwork) => artwork.featured),
      remaining: artworks.filter((artwork) => !artwork.featured),
    };
  }, [additional, available]);

  const isLoading = availableLoading || loading;

  return (
    <section
      id="portfolio"
      className="home-portfolio"
      aria-labelledby="portfolio-heading"
    >
      <HomeNavigation className="home-portfolio-navigation" />
      <header className="home-portfolio-intro">
        <p className="eyebrow">Selected paintings and projects</p>
        <h1 id="portfolio-heading">Portfolio</h1>
      </header>

      {error && <p className="home-portfolio-note">{error}</p>}
      {isLoading && !featured.length && !remaining.length ? (
        <p className="home-portfolio-note">Loading artwork…</p>
      ) : (
        <>
          {featured.length > 0 && (
            <section
              className="home-work-group"
              aria-labelledby="featured-heading"
            >
              <h2 id="featured-heading">Featured Works</h2>
              <div className="home-artwork-list home-featured-list">
                {featured.map((artwork, index) => (
                  <ArtworkShowcaseItem
                    key={artwork.id}
                    artwork={artwork}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}
          {remaining.length > 0 && (
            <section
              className="home-work-group"
              aria-labelledby="works-heading"
            >
              <h2 id="works-heading">Works</h2>
              <div className="home-artwork-list">
                {remaining.map((artwork, index) => (
                  <ArtworkShowcaseItem
                    key={artwork.id}
                    artwork={artwork}
                    index={index + featured.length}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

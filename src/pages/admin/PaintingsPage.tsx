import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { adminApi } from "../../lib/admin-api";
import { formatCurrency } from "../../lib/currency";
import {
  artworkCategories,
  artworkMediums,
  mediumLabel,
} from "../../lib/artwork";
type Painting = {
  id: string;
  title: string;
  type: string;
  category: string;
  medium: string | null;
  completion_year: number | null;
  needs_category_review: boolean;
  status: string;
  sold: boolean;
  inventory: number | null;
  featured: boolean;
  price_in_cents: number;
  updated_at: string;
  image: string;
  painting_images: { storage_path: string }[];
};
export function PaintingsPage() {
  const [paintings, setPaintings] = useState<Painting[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [medium, setMedium] = useState("all");
  const [year, setYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () =>
    adminApi<{ paintings: Painting[] }>("/api/admin/paintings")
      .then((data) => {
        if (!Array.isArray(data.paintings))
          throw new Error("The painting list returned an invalid response.");
        setPaintings(
          data.paintings.filter((painting): painting is Painting =>
            Boolean(painting && typeof painting === "object"),
          ),
        );
        setError("");
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Paintings could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const filtered = useMemo(
    () =>
      paintings
        .filter(
          (p) =>
            String(p.title ?? "")
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "all" ||
              filter === p.status ||
              filter === p.type ||
              filter === p.category ||
              (filter === "review" && p.needs_category_review)) &&
            (medium === "all" || medium === p.medium) &&
            (year === "all" || Number(year) === p.completion_year),
        )
        .sort(
          (a, b) =>
            Number(b.completion_year ?? 0) - Number(a.completion_year ?? 0) ||
            String(a.title ?? "").localeCompare(String(b.title ?? "")),
        ),
    [paintings, query, filter, medium, year],
  );
  const years = [
    ...new Set(paintings.map((p) => p.completion_year).filter(Boolean)),
  ].sort((a, b) => Number(b) - Number(a));
  const archive = async (painting: Painting) => {
    if (!confirm(`Archive “${painting.title}”? It will leave the public shop.`))
      return;
    await adminApi(`/api/admin/paintings?id=${painting.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...painting,
        status: "archived",
        price_in_cents: painting.price_in_cents,
      }),
    });
    load();
  };
  const remove = async (painting: Painting) => {
    if (
      !confirm(
        `Delete “${painting.title}” and all of its stored images? Artwork used by an order will be archived instead.`,
      )
    )
      return;
    await adminApi(`/api/admin/paintings?id=${painting.id}`, {
      method: "DELETE",
    });
    load();
  };
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Paintings</h1>
        </div>
        <Link
          className="primary-button link-button"
          href="/admin/paintings/new"
        >
          Add painting
        </Link>
      </header>
      <div className="admin-filters">
        <input
          aria-label="Search paintings"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter paintings"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "all",
            "published",
            "draft",
            "archived",
            "original",
            "print",
            "review",
            ...artworkCategories.map((category) => category.value),
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filter by medium"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
        >
          <option value="all">All mediums</option>
          {artworkMediums.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="all">All years</option>
          {years.map((item) => (
            <option key={item!} value={item!}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <div className="admin-state">Loading paintings…</div>
      ) : !filtered.length ? (
        <div className="admin-empty">No paintings match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Artwork</th>
                <th>Category</th>
                <th>Medium / year</th>
                <th>Price</th>
                <th>Status</th>
                <th>Inventory</th>
                <th>Featured</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="art-cell">
                      {p.image ? (
                        <img src={p.image} alt="" />
                      ) : (
                        <span className="image-placeholder" />
                      )}
                      <strong>{p.title}</strong>
                    </div>
                  </td>
                  <td>
                    {artworkCategories.find((item) => item.value === p.category)
                      ?.publicLabel ?? p.category}
                    {p.needs_category_review && (
                      <small className="review-note">
                        Review classification
                      </small>
                    )}
                  </td>
                  <td>
                    {[mediumLabel(p.medium ?? undefined), p.completion_year]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td>
                    {p.category === "available"
                      ? formatCurrency(p.price_in_cents)
                      : "—"}
                  </td>
                  <td>
                    <span className={`status status-${p.status}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.sold ? "Sold" : (p.inventory ?? "Unlimited")}</td>
                  <td>{p.featured ? "Yes" : "No"}</td>
                  <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/paintings/${p.id}/edit`}>Edit</Link>
                      <button onClick={() => archive(p)}>Archive</button>
                      <button onClick={() => remove(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type ArtworkRow = {
  id: unknown;
  completion_year?: unknown;
  completion_date?: unknown;
  price_in_cents?: unknown;
};

export function sortArtworkRows<T extends ArtworkRow>(
  rows: T[],
  category: string,
  sort: string,
) {
  return rows.sort((a, b) => {
    if (category === "available" && sort.startsWith("price_"))
      return sort === "price_low"
        ? Number(a.price_in_cents ?? 0) - Number(b.price_in_cents ?? 0)
        : Number(b.price_in_cents ?? 0) - Number(a.price_in_cents ?? 0);
    const direction = sort === "oldest" ? 1 : -1;
    const aYear = Number(a.completion_year ?? 0);
    const bYear = Number(b.completion_year ?? 0);
    if (aYear !== bYear) return (aYear - bYear) * direction;
    const dateDifference = String(a.completion_date ?? "").localeCompare(
      String(b.completion_date ?? ""),
    );
    if (dateDifference) return dateDifference * direction;
    return String(a.id).localeCompare(String(b.id)) * direction;
  });
}

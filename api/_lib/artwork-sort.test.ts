import { describe, expect, it } from "vitest";
import { sortArtworkRows } from "./artwork-sort";

const rows = [
  {
    id: "older",
    completion_year: 2024,
    completion_date: null,
    price_in_cents: 300,
  },
  {
    id: "newer-date",
    completion_year: 2026,
    completion_date: "2026-08-01",
    price_in_cents: 200,
  },
  {
    id: "earlier-date",
    completion_year: 2026,
    completion_date: "2026-01-02",
    price_in_cents: 100,
  },
];

describe("portfolio chronology", () => {
  it.each(["available", "sold", "project"])(
    "sorts %s newest to oldest by artwork date",
    (category) =>
      expect(
        sortArtworkRows([...rows], category, "newest").map((row) => row.id),
      ).toEqual(["newer-date", "earlier-date", "older"]),
  );
  it("sorts oldest to newest", () =>
    expect(
      sortArtworkRows([...rows], "sold", "oldest").map((row) => row.id),
    ).toEqual(["older", "earlier-date", "newer-date"]));
  it("supports available price ordering", () =>
    expect(
      sortArtworkRows([...rows], "available", "price_low").map((row) => row.id),
    ).toEqual(["earlier-date", "newer-date", "older"]));
});

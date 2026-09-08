import { describe, expect, it } from "vitest";
import { canPurchase, mediumLabel } from "./artwork";
import type { Product } from "../types";

const available: Product = {
  id: "one",
  slug: "one",
  name: "One",
  description: "",
  image: "/one.jpg",
  type: "original",
  category: "available",
  purchasable: true,
  priceInCents: 100,
  inventory: 1,
  sold: false,
};

describe("artwork portfolio rules", () => {
  it("allows only genuinely available work to be purchased", () => {
    expect(canPurchase(available)).toBe(true);
    expect(canPurchase({ ...available, category: "sold", sold: true })).toBe(
      false,
    );
    expect(canPurchase({ ...available, category: "project" })).toBe(false);
    expect(canPurchase({ ...available, inventory: 0 })).toBe(false);
    expect(canPurchase({ ...available, purchasable: false })).toBe(false);
  });

  it.each([
    ["oil", "Oil"],
    ["colored_pencil", "Colored Pencil"],
    ["graphite_pencil", "Graphite Pencil"],
  ])("displays %s using its public label", (value, label) => {
    expect(mediumLabel(value)).toBe(label);
  });
});

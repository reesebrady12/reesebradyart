import { describe, expect, it } from "vitest";
import { dollarsToCents, validateProduct } from "./product-validation";
const valid = {
  title: "New Work",
  slug: "new-work",
  type: "original",
  price_in_cents: 10000,
  inventory: 1,
  status: "draft",
};
describe("server product validation", () => {
  it.each([
    ["125", 12500],
    ["450", 45000],
    ["1200", 120000],
    ["45.50", 4550],
    ["$19.9", 1990],
  ])("converts %s dollars to integer cents", (input, expected) =>
    expect(dollarsToCents(input)).toBe(expected),
  );
  it.each(["", "12.345", "-20", "abc"])(
    "rejects invalid dollar input %s",
    (input) => expect(dollarsToCents(input)).toBeNull(),
  );
  it("accepts valid original data", () =>
    expect(validateProduct(valid).title).toBe("New Work"));
  it("requires a title and safe slug", () =>
    expect(() =>
      validateProduct({ ...valid, title: "", slug: "../bad" }),
    ).toThrow("highlighted"));
  it("requires positive integer cents", () =>
    expect(() => validateProduct({ ...valid, price_in_cents: 10.5 })).toThrow(
      "highlighted",
    ));
  it("limits original inventory", () =>
    expect(() => validateProduct({ ...valid, inventory: 2 })).toThrow(
      "highlighted",
    ));
  it("forces sold original inventory to zero", () =>
    expect(() =>
      validateProduct({ ...valid, status: "sold", inventory: 1 }),
    ).toThrow("highlighted"));
  it("rejects negative print inventory", () =>
    expect(() =>
      validateProduct({ ...valid, type: "print", inventory: -1 }),
    ).toThrow("highlighted"));
  it("does not allow sold status for prints", () =>
    expect(() =>
      validateProduct({
        ...valid,
        type: "print",
        inventory: 0,
        status: "sold",
      }),
    ).toThrow("highlighted"));
  it("validates Stripe identifiers", () =>
    expect(() =>
      validateProduct({ ...valid, stripe_price_id: "not-a-price" }),
    ).toThrow("highlighted"));
  it("creates sold portfolio work without price or Stripe data", () => {
    const product = validateProduct({
      title: "Commission",
      slug: "commission",
      type: "original",
      category: "sold",
      status: "published",
      medium: "oil",
      completion_year: 2025,
    });
    expect(product).toMatchObject({
      category: "sold",
      status: "sold",
      sold: true,
      purchasable: false,
      inventory: 0,
      price_in_cents: null,
    });
  });
  it("creates projects without sale fields", () => {
    const product = validateProduct({
      title: "School Study",
      slug: "school-study",
      category: "project",
      status: "published",
      medium: "graphite_pencil",
      completion_year: 2024,
    });
    expect(product).toMatchObject({
      category: "project",
      sold: false,
      purchasable: false,
      inventory: null,
      price_in_cents: null,
    });
  });
  it("rejects arbitrary new medium values", () =>
    expect(() => validateProduct({ ...valid, medium: "crayon" })).toThrow(
      "highlighted",
    ));
});

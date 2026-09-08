import { describe, expect, it } from "vitest";
describe("checkout validation", () => {
  it("rejects an empty cart", async () => {
    const { validateCheckout } = await import("./checkout");
    expect(() => validateCheckout({ items: [] })).toThrow("empty");
  });
  it("rejects invalid quantities", async () => {
    const { validateCheckout } = await import("./checkout");
    expect(() =>
      validateCheckout({
        items: [{ productId: "original-golden-hour", quantity: 0 }],
      }),
    ).toThrow("invalid");
  });
  it("drops browser-controlled prices", async () => {
    const { validateCheckout } = await import("./checkout");
    const [item] = validateCheckout({
      items: [
        {
          productId: "print-wild-flowers",
          variantId: "8x10",
          quantity: 1,
          priceInCents: 1,
        },
      ],
    });
    expect(item).not.toHaveProperty("priceInCents");
  });
});

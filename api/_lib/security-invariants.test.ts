import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260805000000_admin_dashboard.sql"),
  "utf8",
);
const adminHandler = readFileSync(
  resolve(root, "api/admin/[resource].ts"),
  "utf8",
);
const publicCatalog = readFileSync(resolve(root, "api/catalog.ts"), "utf8");
const checkoutHandler = readFileSync(resolve(root, "api/checkout.ts"), "utf8");
const portfolioMigration = readFileSync(
  resolve(root, "supabase/migrations/20260811000000_portfolio_categories.sql"),
  "utf8",
);
const artworkStorageMigration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260910000000_public_artwork_storage.sql",
  ),
  "utf8",
);
const artworkLifecycleMigration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260911000000_artwork_image_lifecycle.sql",
  ),
  "utf8",
);
const browserSource = [
  "src/App.tsx",
  "src/lib/supabase.ts",
  "src/lib/admin-api.ts",
]
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");

describe("security invariants", () => {
  it("authorizes before dispatching every admin resource", () => {
    expect(adminHandler.indexOf("await requireAdmin(request)")).toBeLessThan(
      adminHandler.indexOf("request.query.resource"),
    );
  });

  it("exposes only published or sold products publicly", () => {
    expect(publicCatalog).toContain('.in("status", ["published", "sold"])');
    expect(migration).toContain(
      "status in ('published', 'sold') or is_admin()",
    );
  });

  it("denies public order access and limits direct order updates", () => {
    expect(migration).toContain(
      "revoke all on admin_users, orders, order_items, processed_webhook_events from anon",
    );
    expect(migration).toContain(
      "grant update (fulfillment_status, tracking_number, shipping_carrier, fulfillment_note, updated_at)",
    );
  });

  it("makes portfolio artwork public while restricting writes to admins", () => {
    expect(artworkStorageMigration).toContain(
      "'artwork',\n  'artwork',\n  true",
    );
    expect(artworkStorageMigration).toContain("admins upload artwork files");
    expect(artworkStorageMigration).toContain("admins delete artwork files");
  });

  it("enforces one primary image and atomic image ordering", () => {
    expect(migration).toContain("one_primary_image_per_painting");
    expect(migration).toContain("reorder_painting_images");
    expect(migration).toContain("set_primary_painting_image");
  });

  it("deletes unused artwork records atomically before storage cleanup", () => {
    expect(artworkLifecycleMigration).toContain(
      "create or replace function delete_artwork_record",
    );
    expect(artworkLifecycleMigration).toContain("delete from painting_images");
    expect(adminHandler).toContain('.rpc("delete_artwork_record"');
    expect(adminHandler).toContain(".remove(paths)");
  });

  it("uses status-independent storage paths for new artwork uploads", () => {
    expect(adminHandler).toContain(
      "const artworkRoot = (paintingId: string) => `paintings/${paintingId}`",
    );
    expect(adminHandler).not.toContain("const artworkFolder");
  });

  it("atomically reserves originals before payment", () => {
    expect(migration).toContain("for update loop");
    expect(migration).toContain("reservation_token = p_token");
    expect(migration).toContain("reservation_token = p_reservation_token");
  });

  it("rejects sold and project artwork during checkout", () => {
    expect(checkoutHandler).toContain('product.category !== "available"');
    expect(checkoutHandler).toContain("product.purchasable !== true");
    expect(portfolioMigration).toContain("v_product.category <> 'available'");
  });

  it("moves a paid original into the sold portfolio atomically", () => {
    expect(portfolioMigration).toContain("category = 'sold'");
    expect(portfolioMigration).toContain("purchasable = false");
    expect(portfolioMigration).toContain("inventory = 0");
  });

  it("contains no server secret references in browser source", () => {
    for (const secret of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "RESEND_API_KEY",
    ])
      expect(browserSource).not.toContain(secret);
  });
});

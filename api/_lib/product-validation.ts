export type ProductInput = Record<string, unknown>;
const statuses = ["draft", "published", "archived", "sold"];
const categories = ["available", "sold", "project"];
const mediums = ["oil", "colored_pencil", "graphite_pencil"];
const stripePattern = /^(prod|price)_[A-Za-z0-9]+$/;

export function dollarsToCents(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^\$/, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const dollars = BigInt(match[1]);
  const fractional = BigInt((match[2] ?? "").padEnd(2, "0"));
  const cents = dollars * 100n + fractional;
  return cents > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(cents);
}

export function validateProduct(input: ProductInput) {
  const errors: Record<string, string> = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const slug =
    typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const type = input.type === "print" ? "print" : "original";
  const category = categories.includes(String(input.category))
    ? String(input.category)
    : "available";
  const status =
    typeof input.status === "string" && statuses.includes(input.status)
      ? input.status
      : "draft";
  const price =
    category === "available"
      ? input.price_dollars !== undefined
        ? dollarsToCents(input.price_dollars)
        : Number(input.price_in_cents)
      : null;
  let inventory =
    input.inventory === null || input.inventory === ""
      ? null
      : Number(input.inventory);
  if (!title) errors.title = "Title is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.slug = "Use lowercase letters, numbers, and hyphens.";
  if (
    category === "available" &&
    (price === null || !Number.isInteger(price) || price <= 0)
  )
    errors.price_dollars = "Enter a valid positive dollar amount.";
  const medium = String(input.medium ?? "");
  if (medium && !mediums.includes(medium))
    errors.medium = "Choose a supported medium.";
  const completionDate = input.completion_date
    ? String(input.completion_date)
    : null;
  let completionYear = input.completion_year
    ? Number(input.completion_year)
    : input.year
      ? Number(input.year)
      : null;
  if (completionDate) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completionDate);
    if (!dateMatch || Number.isNaN(Date.parse(`${completionDate}T00:00:00Z`)))
      errors.completion_date = "Enter a valid completion date.";
    else completionYear = Number(dateMatch[1]);
  }
  if (
    completionYear !== null &&
    (!Number.isInteger(completionYear) ||
      completionYear < 1000 ||
      completionYear > 9999)
  )
    errors.completion_year = "Enter a valid four-digit year.";
  if (category === "sold") inventory = 0;
  if (category === "project") inventory = null;
  if (category !== "sold" && status === "sold")
    errors.status = "Only Sold Artwork can use sold status.";
  if (
    category === "available" &&
    type === "original" &&
    inventory !== 0 &&
    inventory !== 1
  )
    errors.inventory = "Original inventory must be zero or one.";
  if (
    category === "available" &&
    status === "published" &&
    type === "original" &&
    inventory !== 1
  )
    errors.inventory =
      "A published available original must have inventory of one.";
  if (
    category === "available" &&
    type === "print" &&
    inventory !== null &&
    (!Number.isInteger(inventory) || inventory < 0)
  )
    errors.inventory = "Print inventory must be zero or a positive integer.";
  if (
    category === "available" &&
    type === "original" &&
    status === "sold" &&
    inventory !== 0
  )
    errors.inventory = "A sold original must have zero inventory.";
  if (type === "print" && status === "sold")
    errors.status = "Use archived status for unavailable prints.";
  for (const field of ["width", "height", "year"] as const) {
    if (input[field] && !Number.isFinite(Number(input[field])))
      errors[field] = "Enter a valid number.";
  }
  if (
    input.stripe_product_id &&
    !stripePattern.test(String(input.stripe_product_id))
  )
    errors.stripe_product_id = "Enter a valid Stripe Product ID.";
  if (
    input.stripe_price_id &&
    !stripePattern.test(String(input.stripe_price_id))
  )
    errors.stripe_price_id = "Enter a valid Stripe Price ID.";
  const variants = Array.isArray(input.product_variants)
    ? input.product_variants.map((value, index) => {
        const variant = value as Record<string, unknown>;
        const variantPrice = Number(variant.price_in_cents);
        const variantInventory =
          variant.inventory === null || variant.inventory === ""
            ? null
            : Number(variant.inventory);
        if (!variant.id || !variant.name)
          errors[`variant_${index}`] = "Every print size needs a name.";
        if (!Number.isInteger(variantPrice) || variantPrice <= 0)
          errors[`variant_${index}`] = "Every print size needs a valid price.";
        if (
          !variant.stripe_price_id ||
          !String(variant.stripe_price_id).startsWith("price_") ||
          !stripePattern.test(String(variant.stripe_price_id))
        )
          errors[`variant_${index}`] =
            "Every print size needs a valid Stripe Price ID.";
        if (
          variantInventory !== null &&
          (!Number.isInteger(variantInventory) || variantInventory < 0)
        )
          errors[`variant_${index}`] = "Variant inventory cannot be negative.";
        return {
          id: String(variant.id),
          name: String(variant.name ?? ""),
          price_in_cents: variantPrice,
          stripe_price_id: String(variant.stripe_price_id ?? ""),
          inventory: variantInventory,
        };
      })
    : [];
  if (
    status === "published" &&
    category === "available" &&
    type === "original" &&
    !input.stripe_price_id
  )
    errors.stripe_price_id = "A published original needs a Stripe Price ID.";
  if (
    status === "published" &&
    category === "available" &&
    type === "print" &&
    !input.stripe_price_id &&
    variants.length === 0
  )
    errors.stripe_price_id =
      "A published print needs a Stripe Price ID or size variants.";
  if (Object.keys(errors).length)
    throw Object.assign(new Error("Check the highlighted fields."), {
      status: 422,
      fields: errors,
    });
  return {
    title,
    slug,
    type,
    status: category === "sold" && status === "published" ? "sold" : status,
    category,
    purchasable:
      category === "available" &&
      input.purchasable !== false &&
      (inventory === null || inventory > 0),
    price_in_cents: price,
    inventory,
    sold: category === "sold" || status === "sold",
    description: String(input.description ?? ""),
    short_description: String(input.short_description ?? ""),
    dimensions:
      input.width && input.height
        ? `${input.width} × ${input.height} ${String(input.dimension_unit ?? "in") === "cm" ? "cm" : "in"}`
        : String(input.dimensions ?? ""),
    width: input.width ? Number(input.width) : null,
    height: input.height ? Number(input.height) : null,
    dimension_unit: String(input.dimension_unit ?? "in"),
    medium: medium || null,
    completion_date: completionDate,
    completion_year: completionYear,
    year: completionYear,
    commissioned: category === "sold" && Boolean(input.commissioned),
    needs_category_review: false,
    collection_label:
      category === "sold" ? String(input.collection_label ?? "") || null : null,
    orientation: String(input.orientation ?? ""),
    featured: Boolean(input.featured),
    stripe_product_id: input.stripe_product_id
      ? String(input.stripe_product_id)
      : null,
    stripe_price_id: input.stripe_price_id
      ? String(input.stripe_price_id)
      : null,
    seo_title: String(input.seo_title ?? ""),
    seo_description: String(input.seo_description ?? ""),
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    product_variants:
      category === "available" && type === "print" ? variants : [],
    published_at: status === "published" ? new Date().toISOString() : null,
    archived_at: status === "archived" ? new Date().toISOString() : null,
  };
}

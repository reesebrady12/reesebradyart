import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { sortArtworkRows } from "./_lib/artwork-sort.js";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET")
    return response.status(405).json({ error: "Method not allowed." });
  try {
    const database = getSupabaseAdmin();
    const value = (input: string | string[] | undefined) =>
      Array.isArray(input) ? input[0] : input;
    const requestedCategory = value(request.query.category) ?? "available";
    const category = ["available", "sold", "project"].includes(
      requestedCategory,
    )
      ? requestedCategory
      : "available";
    const medium = value(request.query.medium);
    const year = value(request.query.year);
    const slug = value(request.query.slug);
    const sort = value(request.query.sort) ?? "newest";
    if (
      medium &&
      !["oil", "colored_pencil", "graphite_pencil"].includes(medium)
    )
      return response.status(422).json({ error: "Invalid medium filter." });

    let query = database
      .from("products")
      .select("*,product_variants(*),painting_images(*)")
      .in("status", ["published", "sold"]);
    if (slug) query = query.eq("slug", slug);
    else {
      query = query.eq("category", category);
      if (category === "available") query = query.eq("purchasable", true);
    }
    if (medium) query = query.eq("medium", medium);
    const nowYear = new Date().getUTCFullYear();
    if (year === "this") query = query.eq("completion_year", nowYear);
    else if (year === "previous")
      query = query.eq("completion_year", nowYear - 1);
    else if (year === "older") query = query.lt("completion_year", nowYear - 1);
    else if (year && /^\d{4}$/.test(year))
      query = query.eq("completion_year", Number(year));
    const { data, error } = await query;
    if (error) throw error;
    sortArtworkRows(data, category, sort);
    let yearQuery = database
      .from("products")
      .select("completion_year")
      .in("status", ["published", "sold"])
      .eq("category", category)
      .not("completion_year", "is", null);
    if (category === "available") yearQuery = yearQuery.eq("purchasable", true);
    if (medium) yearQuery = yearQuery.eq("medium", medium);
    const yearResult = slug ? { data: [], error: null } : await yearQuery;
    if (yearResult.error) throw yearResult.error;
    const years = [
      ...new Set(
        (yearResult.data ?? [])
          .map((product) => product.completion_year)
          .filter(Boolean),
      ),
    ].sort((a, b) => Number(b) - Number(a));
    const products = data.map((product) => ({
      ...product,
      painting_images: [...product.painting_images].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order,
      ),
    }));
    response.setHeader(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );
    return response.status(200).json({ products, years });
  } catch (error) {
    console.error(
      "Public catalog failed:",
      error instanceof Error ? error.message : "Unknown",
    );
    return response
      .status(503)
      .json({ error: "The collection is temporarily unavailable." });
  }
}

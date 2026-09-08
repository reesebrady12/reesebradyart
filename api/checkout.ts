import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import Stripe from "stripe";
import { validateCheckout } from "./_lib/checkout.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Method not allowed." });
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.SITE_URL)
      throw new Error("Checkout is not configured yet.");
    const requestedItems = validateCheckout(request.body ?? {});
    const database = getSupabaseAdmin();
    const { data: products, error: catalogError } = await database
      .from("products")
      .select(
        "id,title,type,status,category,purchasable,sold,inventory,price_in_cents,stripe_price_id,product_variants(id,stripe_price_id,inventory)",
      )
      .in(
        "id",
        requestedItems.map((item) => item.productId),
      );
    if (catalogError)
      throw new Error("Artwork availability could not be confirmed.");
    const items = requestedItems.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (
        !product ||
        product.status !== "published" ||
        product.category !== "available" ||
        product.purchasable !== true ||
        product.sold ||
        product.inventory === 0
      )
        throw new Error("An item is no longer available.");
      if (product.type === "original" && item.quantity !== 1)
        throw new Error("Original paintings are limited to one.");
      const variant = item.variantId
        ? product.product_variants.find((entry) => entry.id === item.variantId)
        : undefined;
      if (product.product_variants.length && !variant)
        throw new Error(`Choose an available option for ${product.title}.`);
      if (variant?.inventory === 0)
        throw new Error(
          `${product.title} is no longer available in that size.`,
        );
      if (variant?.inventory != null && item.quantity > variant.inventory)
        throw new Error(
          `Only ${variant.inventory} of ${product.title} is available in that size.`,
        );
      if (
        product.type === "print" &&
        !variant &&
        product.inventory != null &&
        item.quantity > product.inventory
      )
        throw new Error(
          `Only ${product.inventory} of ${product.title} is available.`,
        );
      const stripePriceId = variant?.stripe_price_id ?? product.stripe_price_id;
      if (!stripePriceId)
        throw new Error(`${product.title} is not configured for checkout yet.`);
      return { ...item, stripePriceId };
    });

    const originalIds = items
      .filter(
        (item) =>
          products.find((product) => product.id === item.productId)?.type ===
          "original",
      )
      .map((item) => item.productId);
    const reservationToken = originalIds.length ? crypto.randomUUID() : null;
    if (reservationToken) {
      const reservation = await database.rpc("reserve_originals", {
        p_product_ids: originalIds,
        p_token: reservationToken,
        // Stripe's expired-session webhook normally releases this after 30
        // minutes. The longer database TTL protects a paid session if webhook
        // delivery is temporarily delayed.
        p_minutes: 1440,
      });
      if (reservation.error)
        throw new Error(
          "An original in your cart is currently reserved or sold.",
        );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: items.map((item) => ({
          price: item.stripePriceId,
          quantity: item.quantity,
        })),
        customer_creation: "always",
        phone_number_collection: { enabled: true },
        billing_address_collection: "required",
        shipping_address_collection: { allowed_countries: ["US"] },
        shipping_options: process.env.STRIPE_STANDARD_SHIPPING_RATE_ID
          ? [{ shipping_rate: process.env.STRIPE_STANDARD_SHIPPING_RATE_ID }]
          : undefined,
        automatic_tax: {
          enabled: process.env.ENABLE_AUTOMATIC_TAX === "true",
        },
        metadata: {
          cart: JSON.stringify(
            items.map(({ productId, variantId, quantity }) => ({
              productId,
              variantId,
              quantity,
            })),
          ),
          reservation_token: reservationToken ?? "",
        },
        success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_URL}/cart?checkout=cancelled`,
      });
    } catch (error) {
      if (reservationToken)
        await database.rpc("release_original_reservation", {
          p_token: reservationToken,
        });
      throw error;
    }
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error(
      "Checkout creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Checkout could not be started.",
    });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import Stripe from "stripe";
import { getSupabaseAdmin } from "./_lib/supabase.js";

export const config = { api: { bodyParser: false } };

const readRawBody = async (request: VercelRequest) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST")
    return response.status(405).send("Method not allowed");
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
    return response.status(500).send("Webhook is not configured");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await readRawBody(request),
      request.headers["stripe-signature"] ?? "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response.status(400).send("Invalid webhook signature");
  }
  if (event.type === "checkout.session.expired") {
    const token = event.data.object.metadata?.reservation_token;
    if (token)
      await getSupabaseAdmin().rpc("release_original_reservation", {
        p_token: token,
      });
    return response.status(200).json({ received: true, released: true });
  }
  if (event.type !== "checkout.session.completed")
    return response.status(200).json({ received: true });

  try {
    const session = event.data.object;
    if (session.payment_status !== "paid")
      return response.status(200).json({ received: true, fulfilled: false });
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    });
    const database = getSupabaseAdmin();
    const priceIds = (expanded.line_items?.data ?? [])
      .map((line) =>
        typeof line.price === "string" ? line.price : line.price?.id,
      )
      .filter((id): id is string => Boolean(id));
    const [
      { data: directProducts, error: productError },
      { data: variants, error: variantError },
    ] = await Promise.all([
      database
        .from("products")
        .select("id,title,type,stripe_price_id")
        .in("stripe_price_id", priceIds),
      database
        .from("product_variants")
        .select("id,name,stripe_price_id,product:products(id,title,type)")
        .in("stripe_price_id", priceIds),
    ]);
    if (productError || variantError)
      throw new Error(`Catalog lookup failed for session ${session.id}`);
    const orderItems = (expanded.line_items?.data ?? []).map((line) => {
      const priceId =
        typeof line.price === "string" ? line.price : line.price?.id;
      const direct = directProducts.find(
        (product) => product.stripe_price_id === priceId,
      );
      const variant = variants.find(
        (entry) => entry.stripe_price_id === priceId,
      );
      const product =
        direct ??
        (Array.isArray(variant?.product)
          ? variant.product[0]
          : variant?.product);
      if (!product)
        throw new Error(`Unknown Stripe price on session ${session.id}`);
      const quantity = line.quantity ?? 1;
      const unitPrice = line.amount_subtotal / quantity;
      return {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        product_name_snapshot: product.title,
        product_type: product.type,
        variant_name_snapshot: variant?.name ?? null,
        quantity,
        unit_price: unitPrice,
        total_price: line.amount_subtotal,
      };
    });
    const customer = expanded.customer_details;
    const shipping =
      expanded.collected_information?.shipping_details ??
      expanded.customer_details;
    const address = shipping?.address;
    const order = {
      stripe_checkout_session_id: expanded.id,
      stripe_payment_intent_id:
        typeof expanded.payment_intent === "string"
          ? expanded.payment_intent
          : null,
      customer_name: shipping?.name ?? customer?.name ?? "",
      customer_email: customer?.email ?? "",
      customer_phone: customer?.phone ?? "",
      shipping_address_line1: address?.line1 ?? "",
      shipping_address_line2: address?.line2 ?? "",
      shipping_city: address?.city ?? "",
      shipping_state: address?.state ?? "",
      shipping_postal_code: address?.postal_code ?? "",
      shipping_country: address?.country ?? "",
      subtotal: expanded.amount_subtotal ?? 0,
      shipping_amount: expanded.total_details?.amount_shipping ?? 0,
      tax_amount: expanded.total_details?.amount_tax ?? 0,
      total: expanded.amount_total ?? 0,
      currency: expanded.currency ?? "usd",
      payment_status: expanded.payment_status,
    };
    const { data, error } = await database.rpc("fulfill_paid_order", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order: order,
      p_items: orderItems,
      p_reservation_token: expanded.metadata?.reservation_token || null,
    });
    if (error) throw error;
    const orderId = typeof data === "string" ? data : session.id;

    if (
      process.env.RESEND_API_KEY &&
      process.env.ORDER_NOTIFICATION_EMAIL &&
      process.env.RESEND_FROM_EMAIL
    ) {
      const itemText = orderItems
        .map(
          (item) =>
            `${item.product_name_snapshot}${item.variant_name_snapshot ? ` — ${item.variant_name_snapshot}` : ""} (${item.product_type}) × ${item.quantity} — ${money(item.total_price)}`,
        )
        .join("\n");
      const addressText = [
        order.shipping_address_line1,
        order.shipping_address_line2,
        `${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}`,
        order.shipping_country,
      ]
        .filter(Boolean)
        .join("\n");
      const text = `Order ID: ${orderId}\nStripe session: ${session.id}\nPayment: ${order.payment_status}\n\nCustomer\n${order.customer_name}\n${order.customer_email}\n${order.customer_phone}\n${addressText}\n\nItems\n${itemText}\n\nSubtotal: ${money(order.subtotal)}\nShipping: ${money(order.shipping_amount)}\nTax: ${money(order.tax_amount)}\nTotal paid: ${money(order.total)}\n\nThis paid order needs fulfillment.`;
      const rows = orderItems
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.product_name_snapshot)}${item.variant_name_snapshot ? `<br><small>${escapeHtml(item.variant_name_snapshot)}</small>` : ""}</td><td>${escapeHtml(item.product_type)}</td><td>${item.quantity}</td><td>${money(item.unit_price)}</td><td>${money(item.total_price)}</td></tr>`,
        )
        .join("");
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: process.env.ORDER_NOTIFICATION_EMAIL,
        subject: `New paid art order — ${order.customer_name} — ${money(order.total)}`,
        text,
        html: `<h1>New paid art order</h1><p><strong>Order:</strong> ${escapeHtml(orderId)}<br><strong>Stripe session:</strong> ${escapeHtml(session.id)}<br><strong>Payment:</strong> ${escapeHtml(order.payment_status)}</p><h2>Customer</h2><p>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.customer_email)}<br>${escapeHtml(order.customer_phone)}<br>${escapeHtml(addressText).replace(/\n/g, "<br>")}</p><h2>Items</h2><table cellpadding="8" cellspacing="0" border="1"><tr><th>Artwork</th><th>Type</th><th>Qty</th><th>Unit</th><th>Total</th></tr>${rows}</table><p>Subtotal: ${money(order.subtotal)}<br>Shipping: ${money(order.shipping_amount)}<br>Tax: ${money(order.tax_amount)}<br><strong>Total paid: ${money(order.total)}</strong></p><p><strong>This order needs fulfillment.</strong></p>`,
        headers: { "Idempotency-Key": event.id },
      });
    }
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error(
      "Paid order fulfillment failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response.status(500).send("Fulfillment failed");
  }
}

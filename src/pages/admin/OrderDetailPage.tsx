/* The loader is intentionally recreated with the current route id. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { adminApi } from "../../lib/admin-api";
import { formatCurrency } from "../../lib/currency";
type Item = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};
type Order = Record<string, unknown> & {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  order_items: Item[];
};
export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () =>
    adminApi<{ order: Order }>(`/api/admin/orders?id=${id}`)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [id]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi(`/api/admin/orders?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fulfillment_status: order!.fulfillment_status,
          tracking_number: order!.tracking_number,
          shipping_carrier: order!.shipping_carrier,
          fulfillment_note: order!.fulfillment_note,
        }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };
  if (error && !order) return <div className="admin-state">{error}</div>;
  if (!order) return <div className="admin-state">Loading order…</div>;
  const address = [
    order.shipping_address_line1,
    order.shipping_address_line2,
    `${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}`,
    order.shipping_country,
  ].filter(Boolean);
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Order {order.id.slice(0, 8)}</p>
          <h1>{order.customer_name}</h1>
        </div>
        <Link className="secondary-button" href="/admin/orders">
          Back to orders
        </Link>
      </header>
      <div className="order-detail-grid">
        <section className="admin-panel">
          <h2>Items</h2>
          {order.order_items.map((item) => (
            <div className="order-line" key={item.id}>
              <div>
                <strong>{item.product_name_snapshot}</strong>
                {item.variant_name_snapshot && (
                  <p>{item.variant_name_snapshot}</p>
                )}
              </div>
              <span>
                {item.quantity} × {formatCurrency(item.unit_price)}
              </span>
              <strong>{formatCurrency(item.total_price)}</strong>
            </div>
          ))}
          <div className="order-totals">
            <p>
              <span>Subtotal</span>
              {formatCurrency(order.subtotal)}
            </p>
            <p>
              <span>Shipping</span>
              {formatCurrency(order.shipping_amount)}
            </p>
            <p>
              <span>Tax</span>
              {formatCurrency(order.tax_amount)}
            </p>
            <p>
              <strong>Total paid</strong>
              <strong>{formatCurrency(order.total)}</strong>
            </p>
          </div>
        </section>
        <aside>
          <section className="admin-panel">
            <h2>Customer</h2>
            <p>
              {order.customer_name}
              <br />
              {order.customer_email}
              <br />
              {order.customer_phone}
            </p>
            <p>
              {address.map(String).map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </p>
          </section>
          <section className="admin-panel">
            <h2>Payment</h2>
            <dl>
              <dt>Status</dt>
              <dd>{order.payment_status}</dd>
              <dt>Date</dt>
              <dd>{new Date(order.created_at).toLocaleString()}</dd>
              <dt>Stripe session</dt>
              <dd className="break-word">
                {String(order.stripe_checkout_session_id)}
              </dd>
              <dt>Payment intent</dt>
              <dd className="break-word">
                {String(order.stripe_payment_intent_id ?? "—")}
              </dd>
            </dl>
          </section>
          <form className="admin-panel fulfillment-form" onSubmit={save}>
            <h2>Fulfillment</h2>
            <label>
              Status
              <select
                value={order.fulfillment_status}
                onChange={(e) =>
                  setOrder({ ...order, fulfillment_status: e.target.value })
                }
              >
                <option value="unfulfilled">Awaiting fulfillment</option>
                <option value="packing">Packing</option>
                <option value="fulfilled">Fulfilled</option>
              </select>
            </label>
            <label>
              Carrier
              <input
                value={String(order.shipping_carrier ?? "")}
                onChange={(e) =>
                  setOrder({ ...order, shipping_carrier: e.target.value })
                }
              />
            </label>
            <label>
              Tracking number
              <input
                value={String(order.tracking_number ?? "")}
                onChange={(e) =>
                  setOrder({ ...order, tracking_number: e.target.value })
                }
              />
            </label>
            <label>
              Private note
              <textarea
                rows={4}
                value={String(order.fulfillment_note ?? "")}
                onChange={(e) =>
                  setOrder({ ...order, fulfillment_note: e.target.value })
                }
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save fulfillment"}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}

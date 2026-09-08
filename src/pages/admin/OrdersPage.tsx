import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { adminApi } from "../../lib/admin-api";
import { formatCurrency } from "../../lib/currency";
type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  total: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  order_items: unknown[];
};
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    adminApi<{ orders: Order[] }>("/api/admin/orders")
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const shown = useMemo(
    () =>
      orders.filter(
        (o) =>
          filter === "all" ||
          o.payment_status === filter ||
          o.fulfillment_status === filter,
      ),
    [orders, filter],
  );
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1>Orders</h1>
        </div>
      </header>
      <div className="admin-filters">
        <select
          aria-label="Filter orders"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "all",
            "paid",
            "unpaid",
            "unfulfilled",
            "packing",
            "fulfilled",
            "cancelled",
            "refunded",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <div className="admin-state">Loading orders…</div>
      ) : !shown.length ? (
        <div className="admin-empty">No orders match this view.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Date</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>
                      {o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <strong>{o.customer_name}</strong>
                    <br />
                    <small>{o.customer_email}</small>
                  </td>
                  <td>{formatCurrency(o.total)}</td>
                  <td>
                    <span className="status">{o.payment_status}</span>
                  </td>
                  <td>
                    <span className="status">{o.fulfillment_status}</span>
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>{o.order_items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

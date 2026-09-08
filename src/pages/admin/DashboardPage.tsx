import { useEffect, useState } from "react";
import { Link } from "wouter";
import { adminApi } from "../../lib/admin-api";
import { formatCurrency } from "../../lib/currency";
type Data = {
  metrics: Record<string, number>;
  recentOrders: {
    id: string;
    customer_name: string;
    total: number;
    created_at: string;
  }[];
};
export function DashboardPage() {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");
  useEffect(() => {
    adminApi<Data>("/api/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="admin-state">
        <p role="alert">{error}</p>
      </div>
    );
  if (!data) return <div className="admin-state">Loading dashboard…</div>;
  const cards = [
    ["Published", data.metrics.published],
    ["Drafts", data.metrics.drafts],
    ["Available originals", data.metrics.availableOriginals],
    ["Sold originals", data.metrics.soldOriginals],
    ["Awaiting fulfillment", data.metrics.awaitingFulfillment],
    ["Gross paid sales", formatCurrency(data.metrics.grossSales)],
  ];
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Studio overview</p>
          <h1>Dashboard</h1>
        </div>
        <div className="admin-actions">
          <Link className="secondary-button" href="/admin/orders">
            View orders
          </Link>
          <Link
            className="primary-button link-button"
            href="/admin/paintings/new"
          >
            Add painting
          </Link>
        </div>
      </header>
      <section className="metric-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-title">
          <h2>Recent paid orders</h2>
          <Link href="/admin/orders">View all</Link>
        </div>
        {data.recentOrders.length ? (
          <div className="simple-list">
            {data.recentOrders.map((order) => (
              <Link href={`/admin/orders/${order.id}`} key={order.id}>
                <span>{order.customer_name || "Customer"}</span>
                <span>{formatCurrency(order.total)}</span>
                <time>{new Date(order.created_at).toLocaleDateString()}</time>
              </Link>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No paid orders yet.</p>
        )}
      </section>
    </>
  );
}

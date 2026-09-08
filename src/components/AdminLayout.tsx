import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          RB / Admin
        </Link>
        <nav aria-label="Admin navigation">
          <Link className={location === "/admin" ? "active" : ""} href="/admin">
            Dashboard
          </Link>
          <Link
            className={location.startsWith("/admin/paintings") ? "active" : ""}
            href="/admin/paintings"
          >
            Paintings
          </Link>
          <Link
            className={location.startsWith("/admin/orders") ? "active" : ""}
            href="/admin/orders"
          >
            Orders
          </Link>
          <Link href="/">View shop</Link>
        </nav>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate("/admin/login");
          }}
        >
          Log out
        </button>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "../context/AuthContext";
export function AdminGuard({ children }: { children: ReactNode }) {
  const { session, loading, authorized, forbidden } = useAuth();
  if (loading)
    return <div className="admin-state">Checking secure session…</div>;
  if (!session) return <Redirect to="/admin/login" />;
  if (forbidden)
    return (
      <div className="admin-state">
        <h1>Access forbidden</h1>
        <p>
          This account is authenticated but is not an authorized administrator.
        </p>
      </div>
    );
  if (!authorized)
    return (
      <div className="admin-state">Authorization could not be confirmed.</div>
    );
  return children;
}

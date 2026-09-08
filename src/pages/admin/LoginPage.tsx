import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
export function LoginPage() {
  const { authorized, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resetComplete =
    new URLSearchParams(window.location.search).get("reset") === "success";
  if (authorized) return <Redirect to="/admin" />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    if (!supabase) {
      setError("Supabase browser credentials are not configured.");
      setLoading(false);
      return;
    }
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    await refresh();
    navigate("/admin");
  };
  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <p className="eyebrow">Private studio</p>
        <h1>Admin sign in</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {resetComplete && (
          <p className="form-success" role="status">
            Your password was updated. Sign in with the new password.
          </p>
        )}
        <button className="primary-button" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <Link className="text-link" href="/admin/forgot-password">
          Forgot your password?
        </Link>
        <p className="fine-print">
          Access is restricted to authorized administrators.
        </p>
      </form>
    </main>
  );
}

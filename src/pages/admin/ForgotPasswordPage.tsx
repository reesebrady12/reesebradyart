import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { supabase } from "../../lib/supabase";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase browser credentials are not configured.");
      return;
    }
    setSending(true);
    setError("");
    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setSending(false);
    if (result.error) {
      setError(
        "The recovery email could not be sent. Wait a moment and try again.",
      );
      return;
    }
    setSent(true);
  };

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <p className="eyebrow">Private studio</p>
        <h1>Reset password</h1>
        {sent ? (
          <>
            <p className="auth-message" role="status">
              If an account exists for that email, Supabase has sent a fresh
              recovery link. Keep this website running and open the newest
              email.
            </p>
            <Link className="text-link" href="/admin/login">
              Return to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="auth-message">
              Enter your admin email and we’ll send a one-time recovery link.
            </p>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={sending}>
              {sending ? "Sending…" : "Send recovery email"}
            </button>
            <Link className="text-link" href="/admin/login">
              Return to sign in
            </Link>
          </>
        )}
      </form>
    </main>
  );
}

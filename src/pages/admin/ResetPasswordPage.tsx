import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  const linkParameters = new URLSearchParams(window.location.hash.slice(1));
  const linkError = linkParameters.get("error")
    ? linkParameters.get("error_code") === "otp_expired"
      ? "This recovery link has expired or was already used. Request a new one."
      : "This recovery link is invalid. Request a new one."
    : "";
  const configurationError = supabase
    ? ""
    : "Supabase browser credentials are not configured.";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [checking, setChecking] = useState(Boolean(supabase && !linkError));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(linkError || configurationError);

  useEffect(() => {
    if (!supabase || linkError) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [linkError]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (!supabase || !ready) {
      setError("Request a new recovery link before changing your password.");
      return;
    }
    setSaving(true);
    const result = await supabase.auth.updateUser({ password });
    if (result.error) {
      setError(result.error.message || "The password could not be changed.");
      setSaving(false);
      return;
    }
    await logout();
    navigate("/admin/login?reset=success");
  };

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <p className="eyebrow">Private studio</p>
        <h1>Choose a new password</h1>
        {checking ? (
          <p className="auth-message" role="status">
            Verifying your recovery link…
          </p>
        ) : ready ? (
          <>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={saving}>
              {saving ? "Updating…" : "Update password"}
            </button>
          </>
        ) : (
          <>
            <p className="form-error" role="alert">
              {error || "No valid recovery session was found."}
            </p>
            <Link
              className="primary-button link-button"
              href="/admin/forgot-password"
            >
              Request a new link
            </Link>
          </>
        )}
      </form>
    </main>
  );
}

import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useCart } from "../context/CartContext";

export function SuccessPage() {
  const params = new URLSearchParams(useSearch());
  const { clearCart } = useCart();
  const sessionId = params.get("session_id");
  useEffect(() => {
    if (sessionId) clearCart();
  }, [sessionId, clearCart]);
  return (
    <section className="message-page">
      <p className="eyebrow">Order received</p>
      <h1>Thank you.</h1>
      <p>
        Your payment was successful. A receipt is on its way to your email, and
        your artwork will be prepared with care.
      </p>
      {sessionId && (
        <p className="order-reference">Order reference: {sessionId}</p>
      )}
      <Link className="text-link" href="/">
        Return to the collection
      </Link>
    </section>
  );
}

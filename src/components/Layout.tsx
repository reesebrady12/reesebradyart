import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "../context/CartContext";

export function Layout({ children }: { children: ReactNode }) {
  const { itemCount } = useCart();
  const [location] = useLocation();
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          Reese Brady
        </Link>
        <nav aria-label="Main navigation">
          <Link
            href="/available"
            className={location.startsWith("/available") ? "active" : ""}
          >
            Available
          </Link>
          <Link
            href="/sold"
            className={location.startsWith("/sold") ? "active" : ""}
          >
            Sold
          </Link>
          <Link
            href="/projects"
            className={location.startsWith("/projects") ? "active" : ""}
          >
            Projects
          </Link>
          <Link
            href="/cart"
            className={location === "/cart" ? "active" : ""}
            aria-label={`Cart with ${itemCount} items`}
          >
            Cart <span className="cart-count">{itemCount}</span>
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <span>Reese Brady Art</span>
        <span>Original paintings & fine-art prints</span>
      </footer>
    </>
  );
}

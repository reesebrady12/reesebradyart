import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ECOMMERCE_ENABLED } from "../config/features";
import { useCart } from "../context/CartContext";
import { PortfolioLink } from "./PortfolioLink";

const links = [
  { href: "/about", label: "About" },
  { href: "/#portfolio", label: "Portfolio" },
  { href: "/available", label: "Available" },
  { href: "/sold", label: "Sold" },
  { href: "/projects", label: "Projects" },
  { href: "/cart", label: "Cart" },
];

export function HomeNavigation({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { itemCount } = useCart();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const overlay = closeButton.current?.closest(".home-menu-overlay");
      const focusable = Array.from(
        overlay?.querySelectorAll<HTMLElement>("button, a[href]") ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <header className={`site-header responsive-site-header ${className}`}>
        <Link className="home-wordmark" href="/">
          Reese Brady Art
        </Link>
        <nav className="desktop-navigation" aria-label="Main navigation">
          {links.map((link) =>
            link.href === "/#portfolio" ? (
              <PortfolioLink
                key={link.href}
                className={
                  location === "/" && window.location.hash === "#portfolio"
                    ? "active"
                    : ""
                }
              />
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={location === link.href ? "active" : ""}
                aria-label={
                  link.href === "/cart"
                    ? ECOMMERCE_ENABLED
                      ? `Cart with ${itemCount} items`
                      : "Cart — shop coming soon"
                    : undefined
                }
              >
                {link.label}
                {link.href === "/cart" && ECOMMERCE_ENABLED && (
                  <span className="cart-count">{itemCount}</span>
                )}
              </Link>
            ),
          )}
        </nav>
        <button
          ref={menuButton}
          className="menu-toggle"
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="home-navigation"
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
        </button>
      </header>

      {open && (
        <div
          id="home-navigation"
          className="home-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <button
            ref={closeButton}
            className="menu-close"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          >
            <span />
            <span />
          </button>
          <nav className="home-menu-links" aria-label="Main navigation">
            {links.map((link) =>
              link.href === "/#portfolio" ? (
                <PortfolioLink
                  key={link.href}
                  onNavigate={() => setOpen(false)}
                />
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      )}
    </>
  );
}

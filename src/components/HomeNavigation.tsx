import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const links = [
  { href: "/about", label: "About" },
  { href: "/available", label: "Available Work" },
  { href: "/sold", label: "Sold Work" },
  { href: "/projects", label: "Projects" },
  { href: "/cart", label: "Cart" },
];

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
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
      <header className="home-header">
        <Link className="home-wordmark" href="/">
          Reese Brady Art
        </Link>
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
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

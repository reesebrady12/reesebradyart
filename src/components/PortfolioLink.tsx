import type { MouseEvent, ReactNode } from "react";
import { Link, useLocation } from "wouter";

export function PortfolioLink({
  children = "Portfolio",
  className,
  onNavigate,
}: {
  children?: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();

  const followAnchor = (event: MouseEvent<HTMLAnchorElement>) => {
    if (location !== "/") {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    window.history.pushState(null, "", "/#portfolio");
    onNavigate?.();
    window.requestAnimationFrame(() => {
      document.getElementById("portfolio")?.scrollIntoView?.({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  };

  return (
    <Link className={className} href="/#portfolio" onClick={followAnchor}>
      {children}
    </Link>
  );
}

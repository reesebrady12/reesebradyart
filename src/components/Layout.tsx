import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { HomeNavigation } from "./HomeNavigation";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isHome = location === "/";
  if (isHome) return <main className="home-main">{children}</main>;
  return (
    <>
      <HomeNavigation />
      <main>{children}</main>
      <footer>
        <span>Reese Brady Art</span>
        <span>Original paintings & fine-art prints</span>
      </footer>
    </>
  );
}

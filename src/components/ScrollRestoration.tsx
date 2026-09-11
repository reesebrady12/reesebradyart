import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";

const restorePublicScroll = () => {
  if (window.location.pathname.startsWith("/admin")) return;

  if (
    window.location.pathname === "/" &&
    window.location.hash === "#portfolio"
  ) {
    document.getElementById("portfolio")?.scrollIntoView?.({ block: "start" });
    return;
  }

  const scrollingElement =
    document.scrollingElement ?? document.documentElement;
  scrollingElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

export function ScrollRestoration() {
  const [location] = useLocation();

  useLayoutEffect(restorePublicScroll, [location]);

  useEffect(() => {
    window.addEventListener("hashchange", restorePublicScroll);
    window.addEventListener("popstate", restorePublicScroll);
    return () => {
      window.removeEventListener("hashchange", restorePublicScroll);
      window.removeEventListener("popstate", restorePublicScroll);
    };
  }, []);

  return null;
}

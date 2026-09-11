import { useEffect } from "react";
import { HomeHero } from "../components/home/HomeHero";
import { HomePortfolio } from "../components/home/HomePortfolio";

export function ShopPage() {
  useEffect(() => {
    document.body.classList.add("home-page-active");
    document.documentElement.classList.add("home-scroll-active");
    const hero = document.querySelector(".home-hero");
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) =>
              document.documentElement.classList.toggle(
                "home-scroll-active",
                entry.isIntersecting,
              ),
            { threshold: 0.01 },
          )
        : null;
    if (hero) observer?.observe(hero);

    return () => {
      observer?.disconnect();
      document.body.classList.remove("home-page-active");
      document.documentElement.classList.remove("home-scroll-active");
    };
  }, []);

  return (
    <>
      <HomeHero />
      <HomePortfolio />
    </>
  );
}

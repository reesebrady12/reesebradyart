import { useEffect } from "react";
import { HomeHero } from "../components/home/HomeHero";
import { HomePortfolio } from "../components/home/HomePortfolio";

export function ShopPage() {
  useEffect(() => {
    document.body.classList.add("home-page-active");
    document.documentElement.classList.add("home-scroll-active");

    return () => {
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

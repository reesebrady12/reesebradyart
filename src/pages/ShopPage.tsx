import { useEffect, useState } from "react";
import { HomeNavigation } from "../components/HomeNavigation";
import { heroImages } from "../data/heroImages";

export function ShopPage() {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    document.body.classList.add("home-page-active");
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const queueNextImage = () => {
      const nextIndex = (activeImage + 1) % heroImages.length;
      const nextImage = new Image();
      nextImage.onload = () => setActiveImage(nextIndex);
      nextImage.src = heroImages[nextIndex].src;
      timeout = setTimeout(queueNextImage, 5000);
    };

    if (!reducedMotion && heroImages.length > 1) {
      timeout = setTimeout(queueNextImage, 5000);
    }

    return () => {
      document.body.classList.remove("home-page-active");
      if (timeout) clearTimeout(timeout);
    };
  }, [activeImage]);

  return (
    <section className="home-hero" aria-label="Reese Brady Art">
      <div className="home-slideshow" aria-hidden="true">
        {heroImages.map((image, index) => (
          <img
            key={image.src}
            className={index === activeImage ? "is-active" : ""}
            src={image.src}
            alt=""
            style={{ objectPosition: image.position ?? "center" }}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
          />
        ))}
      </div>
      <HomeNavigation />
    </section>
  );
}

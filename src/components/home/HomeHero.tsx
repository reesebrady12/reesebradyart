import { useEffect, useState } from "react";
import { HomeNavigation } from "../HomeNavigation";
import { heroImages } from "../../data/heroImages";
import { getArtworkPublicUrl } from "../../lib/artwork-storage";

export function HomeHero() {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion || heroImages.length < 2) return;

    const nextIndex = (activeImage + 1) % heroImages.length;
    const timeout = window.setTimeout(() => {
      const nextImage = new Image();
      nextImage.onload = () => setActiveImage(nextIndex);
      nextImage.src = getArtworkPublicUrl(heroImages[nextIndex].path);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [activeImage]);

  return (
    <section className="home-hero" aria-label="Reese Brady Art">
      <div className="home-slideshow" aria-hidden="true">
        {heroImages.map((image, index) => (
          <img
            key={image.path}
            className={index === activeImage ? "is-active" : ""}
            src={getArtworkPublicUrl(image.path)}
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

import { Link } from "wouter";
import type { CSSProperties } from "react";
import type { Product } from "../../types";

export function ArtworkShowcaseItem({
  artwork,
  index,
}: {
  artwork: Product;
  index: number;
}) {
  const primaryImage = artwork.images?.[0];
  const dimensions =
    primaryImage?.width && primaryImage.height
      ? ({
          "--artwork-ratio": `${primaryImage.width} / ${primaryImage.height}`,
        } as CSSProperties)
      : undefined;
  const year = artwork.completionYear ?? artwork.year;

  return (
    <article className={`home-artwork home-artwork-${(index % 4) + 1}`}>
      <Link href={`/work/${artwork.slug}`} aria-label={`View ${artwork.name}`}>
        <span className="home-artwork-image" style={dimensions}>
          <img
            src={artwork.image}
            alt={primaryImage?.alt || artwork.name}
            loading="lazy"
            decoding="async"
            width={primaryImage?.width}
            height={primaryImage?.height}
          />
        </span>
        <span className="home-artwork-caption">
          <span>{artwork.name}</span>
          {year ? <time dateTime={String(year)}>{year}</time> : null}
        </span>
      </Link>
    </article>
  );
}

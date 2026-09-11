export type HeroImage = {
  path: string;
  position?: string;
};

// HOMEPAGE SLIDESHOW
// Add, remove, reorder, or replace entries here. `position` is passed directly
// to CSS object-position, so it can be used to fine-tune each image's crop.
export const heroImages: HeroImage[] = [
  { path: "home/bigsur2.jpeg", position: "center" },
  { path: "home/carl.jpeg", position: "center" },
  { path: "home/wildflowers.jpeg", position: "center" },
  { path: "home/fam.jpeg", position: "center" },
  { path: "home/joe.jpeg", position: "center" },
  { path: "home/anders.jpeg", position: "center" },
];

export type HeroImage = {
  src: string;
  position?: string;
};

// HOMEPAGE SLIDESHOW
// Add, remove, reorder, or replace entries here. `position` is passed directly
// to CSS object-position, so it can be used to fine-tune each image's crop.
export const heroImages: HeroImage[] = [
  { src: "/art/anders.HEIC", position: "center" },
  { src: "/art/carl.HEIC", position: "center top%" },
  { src: "/art/fam.HEIC", position: "center top%" },
  { src: "/art/golden.HEIC", position: "center top%" },
  { src: "/art/josie.HEIC", position: "center top%" },
  { src: "/art/fam.HEIC", position: "center top%" },
  { src: "/art/alyssa.HEIC", position: "center top%" },
];

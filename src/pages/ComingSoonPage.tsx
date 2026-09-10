import { Link } from "wouter";

export function ComingSoonPage() {
  return (
    <section className="coming-soon-page">
      <p className="eyebrow">Reese Brady Art</p>
      <h1>Shop coming soon</h1>
      <p>
        Original artwork and prints will be available to purchase here soon.
      </p>
      <Link className="text-link" href="/available">
        Browse the portfolio
      </Link>
    </section>
  );
}

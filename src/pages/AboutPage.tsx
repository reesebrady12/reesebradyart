import { getArtworkPublicUrl } from "../lib/artwork-storage";

const aboutImagePath = "about/about-me.jpeg";

export function AboutPage() {
  return (
    <article className="about-page">
      <img
        className="about-portrait"
        src={getArtworkPublicUrl(aboutImagePath)}
        alt="Portrait of Reese Brady"
      />
      <section className="about-copy" aria-labelledby="about-heading">
        <h1 id="about-heading">About</h1>
        <div>
          <p>
            Hi, I’m Reese Brady. I’ve been painting for about 10 years, after
            first picking it up as a hobby in sixth grade. My first time was
            painting was after seeing a time lapse on Instagram and wanting to
            try to copy it. I sold my first commissioned painting in seventh
            grade, and I’ve been creating and selling artwork ever since.
          </p>
          <p>
            As I’ve gotten older, I’ve fallen in love with oil painting, which
            is now the main focus of my work, though I still come back to
            graphite every once in a while. I paint the things, places, and
            moments that catch my attention, and I’m always experimenting with
            where to take my work next.
          </p>
          <p>Thanks for checking my website out!</p>
        </div>
      </section>
    </article>
  );
}

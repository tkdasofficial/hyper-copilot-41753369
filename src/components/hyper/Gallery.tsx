import { Heart, Copy } from "lucide-react";
import g1 from "@/assets/gallery-1.jpg";
import g2 from "@/assets/gallery-2.jpg";
import g3 from "@/assets/gallery-3.jpg";
import g4 from "@/assets/gallery-4.jpg";

const items = [
  {
    src: g1,
    w: 768,
    h: 960,
    prompt: "chrome liquid-metal orchid blooming in zero gravity, iridescent light",
    model: "Hyper Image Flash",
    alt: "Iridescent chrome orchid generated on a dark background",
  },
  {
    src: g2,
    w: 768,
    h: 640,
    prompt: "curved concrete pavilion at dusk in the desert, warm amber spill",
    model: "Hyper Image Flash",
    alt: "Curved concrete and glass pavilion in a desert at sunset",
  },
  {
    src: g3,
    w: 768,
    h: 960,
    prompt: "astronaut-explorer with holographic visor reflecting a neon city",
    model: "Portrait XL",
    alt: "Portrait of an astronaut with neon-lit helmet visor",
  },
  {
    src: g4,
    w: 768,
    h: 640,
    prompt: "translucent glass ribbons in coral and violet, soft caustics",
    model: "Abstract 3D",
    alt: "Abstract translucent glass ribbons in violet and coral",
  },
];

export function Gallery() {
  return (
    <section aria-labelledby="gallery-heading" className="mt-16">
      <div className="flex items-center gap-3">
        <h2 id="gallery-heading" className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Made with Hyper Copilot
        </h2>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Community
        </span>
      </div>

      <div className="mt-5 columns-1 gap-3 sm:columns-2 xl:columns-3 [&>*]:mb-3">
        {items.map((item) => (
          <figure
            key={item.prompt}
            className="group relative break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <img
              src={item.src}
              alt={item.alt}
              width={item.w}
              height={item.h}
              loading="lazy"
              className="w-full transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-background via-background/80 to-transparent p-3.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="line-clamp-2 text-[12.5px] leading-snug text-foreground">
                {item.prompt}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.model}
              </p>
            </figcaption>
            <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full border border-border-strong bg-background/70 backdrop-blur"
              >
                <Heart className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full border border-border-strong bg-background/70 backdrop-blur"
              >
                <Copy className="h-4 w-4" strokeWidth={1.9} />
              </span>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}

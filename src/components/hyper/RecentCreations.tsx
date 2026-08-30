import g1 from "@/assets/gallery-1.jpg";
import g2 from "@/assets/gallery-2.jpg";
import g3 from "@/assets/gallery-3.jpg";
import g4 from "@/assets/gallery-4.jpg";

const items = [
  {
    src: g1,
    prompt: "chrome liquid-metal orchid blooming in zero gravity, iridescent light",
    meta: "Hyper Image Flash · 4:5",
    alt: "Iridescent chrome orchid generated on a dark background",
  },
  {
    src: g2,
    prompt: "curved concrete pavilion at dusk in the desert, warm amber spill",
    meta: "Hyper Image Flash · 3:2",
    alt: "Curved concrete and glass pavilion in a desert at sunset",
  },
  {
    src: g3,
    prompt: "astronaut-explorer with holographic visor reflecting a neon city",
    meta: "Hyper Image Quality · 2:3",
    alt: "Portrait of an astronaut with neon-lit helmet visor",
  },
  {
    src: g4,
    prompt: "translucent glass ribbons in coral and violet, soft caustics",
    meta: "Hyper Image Flash · 16:9",
    alt: "Abstract translucent glass ribbons in violet and coral",
  },
];

export function RecentCreations() {
  return (
    <section aria-labelledby="recent-creations-heading" className="mt-6">
      <div className="flex items-center gap-3">
        <h2 id="recent-creations-heading" className="text-lg font-extrabold tracking-tight">
          Recent creations
        </h2>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {items.length} images
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.prompt}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <img
              src={item.src}
              alt={item.alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-background via-background/80 to-transparent p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="line-clamp-2 text-[12px] leading-snug text-foreground">{item.prompt}</p>
              <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.meta}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

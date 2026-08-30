import { Sparkles } from "lucide-react";
import { recentCreations } from "@/lib/content";

export function RecentCreations() {
  return (
    <section aria-labelledby="recent-creations-heading" className="mt-6">
      <div className="flex items-center gap-3">
        <h2 id="recent-creations-heading" className="text-lg font-extrabold tracking-tight">
          Recent creations
        </h2>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {recentCreations.length} images
        </span>
      </div>

      {recentCreations.length === 0 ? (
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-2.5 text-[13.5px] font-semibold">No creations yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Your latest renders will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recentCreations.map((item) => (
            <figure
              key={item.id}
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
      )}
    </section>
  );
}

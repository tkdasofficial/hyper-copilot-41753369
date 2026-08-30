import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Search, Trash2, ImageIcon, Video, AudioLines, PenTool } from "lucide-react";
import { StudioLayout } from "@/components/hyper/StudioLayout";
import { cn } from "@/lib/utils";
import { libraryAssets, type AssetKind, type LibraryAsset } from "@/lib/content";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Manage Your AI Generations | Hyper Copilot" },
      {
        name: "description",
        content:
          "Browse, search, download and delete every image, video, audio and vector asset you have generated in Hyper Copilot.",
      },
      { property: "og:title", content: "Library — Manage Your AI Generations" },
      {
        property: "og:description",
        content: "One place for every generation and asset you create in Hyper Copilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const kindIcon: Record<AssetKind, typeof ImageIcon> = {
  Image: ImageIcon,
  Video: Video,
  Audio: AudioLines,
  Vector: PenTool,
};

const filters = ["All", "Image", "Video", "Audio", "Vector"] as const;

function LibraryPage() {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) => (filter === "All" || a.kind === filter) && (!q || a.prompt.toLowerCase().includes(q)),
    );
  }, [assets, filter, query]);

  return (
    <StudioLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Library</h1>
          <p className="text-[13px] text-muted-foreground">
            Every generation and asset you create, in one place.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <input
              aria-label="Search library"
              placeholder="Search your generations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  filter === f
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <p className="text-[14px] font-semibold">No assets found</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Try a different search or filter, or generate something new.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((a) => {
              const Icon = kindIcon[a.kind];
              return (
                <article
                  key={a.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div className="relative aspect-square bg-surface-2">
                    {a.src ? (
                      <img
                        src={a.src}
                        alt={a.alt ?? a.prompt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <Icon className="h-8 w-8" strokeWidth={1.6} />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-border-strong bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                      <Icon className="h-3 w-3" strokeWidth={2} />
                      {a.kind}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-[12.5px] leading-snug">{a.prompt}</p>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {a.meta} · {a.date}
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => toast("Download started", { description: a.prompt })}
                        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={2} />
                        Download
                      </button>
                      <button
                        type="button"
                        aria-label="Delete asset"
                        onClick={() => {
                          setAssets((prev) => prev.filter((x) => x.id !== a.id));
                          toast("Asset deleted");
                        }}
                        className="ml-auto grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </StudioLayout>
  );
}

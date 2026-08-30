import { Check, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type VirtualModel = {
  id: string;
  name: string;
  meta: string;
  seedHue: number;
};

export function ModelRail({
  models,
  selectedId,
  onSelect,
  onCreate,
}: {
  models: VirtualModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {models.map((m) => {
        const on = m.id === selectedId;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(m.id)}
            className={cn(
              "relative aspect-square w-[92px] shrink-0 overflow-hidden rounded-xl border bg-surface text-left transition-colors",
              on ? "border-primary" : "border-border hover:border-border-strong",
            )}
          >
            <div
              aria-hidden
              className="grid h-full w-full place-items-center"
              style={{
                background: `linear-gradient(140deg, hsl(${m.seedHue} 70% 22%), hsl(${(m.seedHue + 40) % 360} 60% 12%))`,
              }}
            >
              <User className="h-7 w-7 text-white/70" strokeWidth={1.4} />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5">
              <p className="truncate text-[11px] font-bold text-white">{m.name}</p>
            </div>
            {on && (
              <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" strokeWidth={2.6} />
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        className="flex aspect-square w-[92px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/60 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        <span className="text-[10.5px] font-bold">New</span>
      </button>
    </div>
  );
}

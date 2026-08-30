import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  ImageIcon,
  PenTool,
  Plus,
  Ratio,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  generateImage,
  generateSpeech,
  pollVideo,
  startVideo,
  uploadReference,
} from "@/lib/generation.functions";
import { ResultsGrid, type GenResult } from "./ResultsGrid";

const modalities = [
  { label: "Image", icon: ImageIcon },
  { label: "Video", icon: Video },
  { label: "Audio", icon: AudioLines },
  { label: "Vector", icon: PenTool },
];

const imageModels = [
  {
    id: "hyper-image-speed",
    name: "Hyper Image Speed",
    note: "Fastest drafts · text to image",
  },
  {
    id: "hyper-image-flash",
    name: "Hyper Image Flash",
    note: "Balanced · text & image to image",
  },
  {
    id: "hyper-image-quality",
    name: "Hyper Image Quality",
    note: "Highest fidelity · text & image to image",
  },
];

const modelsByModality: Record<string, { id: string; name: string; note: string }[]> = {
  Image: imageModels,
  Video: [
    { id: "hyper-video-omni", name: "Hyper Video Omni", note: "Text & image to video" },
  ],
  Audio: [
    { id: "hyper-audio-omni", name: "Hyper Audio Omni", note: "Text to speech" },
  ],
  Vector: imageModels,
};


const ratios = [
  { label: "1:1", note: "Square", w: 1, h: 1 },
  { label: "4:5", note: "Portrait", w: 4, h: 5 },
  { label: "2:3", note: "Portrait tall", w: 2, h: 3 },
  { label: "9:16", note: "Story", w: 9, h: 16 },
  { label: "3:4", note: "Classic portrait", w: 3, h: 4 },
  { label: "4:3", note: "Classic landscape", w: 4, h: 3 },
  { label: "3:2", note: "Photo", w: 3, h: 2 },
  { label: "16:9", note: "Widescreen", w: 16, h: 9 },
  { label: "21:9", note: "Cinematic", w: 21, h: 9 },
];

const styles = [
  { id: "heaven", name: "HEAVEN", note: "Signature spinal style", signature: true },
  { id: "none", name: "None", note: "Model default" },
  { id: "photo", name: "Photographic", note: "Realistic lensing" },
  { id: "cinematic", name: "Cinematic", note: "Filmic grade" },
  { id: "anime", name: "Anime", note: "Cel shaded" },
  { id: "3d", name: "3D Render", note: "Studio CGI" },
  { id: "line", name: "Line Art", note: "Single stroke" },
  { id: "noir", name: "Noir", note: "High contrast B&W" },
];

const advancedModes = [
  { id: "reference", name: "Reference", note: "Match subject from an image" },
  { id: "transform", name: "Transform", note: "Restyle an existing image" },
  { id: "composition", name: "Composition", note: "Keep layout & framing" },
  { id: "palette", name: "Color palette", note: "Borrow colors only" },
  { id: "character", name: "Character", note: "Keep identity consistent" },
  { id: "inpaint", name: "Inpaint", note: "Edit a masked region" },
];

const suggestions = [
  "a chrome jellyfish drifting through a neon canyon",
  "editorial product shot of a matte black perfume bottle",
  "isometric cyberpunk apartment, warm rim light",
  "hand-drawn botanical vector set, single line",
];

function Chip({
  icon: Icon,
  children,
  active,
  caret = true,
  onClick,
}: {
  icon: typeof Ratio;
  children: React.ReactNode;
  active?: boolean;
  caret?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
        active
          ? "border-border-strong bg-surface-2 text-foreground"
          : "border-border bg-surface-2/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
      <span className="whitespace-nowrap">{children}</span>
      {caret ? <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2.2} /> : null}
    </button>
  );
}

function OptionRow({
  title,
  note,
  selected,
  onClick,
  accent,
}: {
  title: string;
  note?: string | undefined;
  selected?: boolean | undefined;
  onClick: () => void;
  accent?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2",
        selected && "bg-surface-2",
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-semibold",
            accent ? "text-spectral" : "text-foreground",
          )}
        >
          {title}
        </span>
        {note ? (
          <span className="block truncate text-[11px] text-muted-foreground">{note}</span>
        ) : null}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2.4} /> : null}
    </button>
  );
}

export function PromptComposer() {
  const [active, setActive] = useState("Image");
  const models = modelsByModality[active] ?? imageModels;
  const [value, setValue] = useState("");
  const [model, setModel] = useState(models[0]!);
  const [ratio, setRatio] = useState(ratios[0]!);
  const [style, setStyle] = useState(styles[0]!);
  const [styleStrength, setStyleStrength] = useState([65]);
  const [modes, setModes] = useState<string[]>([]);
  const [refs, setRefs] = useState<{ id: string; name: string; url: string }[]>([]);
  const [count, setCount] = useState([4]);
  const [seedLocked, setSeedLocked] = useState(false);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999));
  const [results, setResults] = useState<GenResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleMode = (id: string) =>
    setModes((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const advancedLabel = useMemo(() => {
    if (modes.length === 0) return "Advanced";
    const first = advancedModes.find((m) => m.id === modes[0])?.name ?? "Advanced";
    return modes.length > 1 ? `${first} +${modes.length - 1}` : first;
  }, [modes]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, 4)
      .map((f) => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, url: URL.createObjectURL(f) }));
    setRefs((r) => [...r, ...next].slice(0, 4));
    if (next.length && modes.length === 0) setModes(["reference"]);
  };

  const generate = async () => {
    if (!value.trim()) {
      toast.error("Describe what you want to create first.");
      return;
    }
    if (active !== "Image") {
      toast.info(`${active} generation is coming soon. Image generation is live now.`);
      return;
    }
    if (!seedLocked) setSeed(Math.floor(Math.random() * 999999));

    const prompt = value.trim();
    const n = count[0] ?? 4;
    const baseId = `${Date.now()}`;
    const placeholders: GenResult[] = Array.from({ length: n }, (_, i) => ({
      id: `${baseId}-${i}`,
      prompt,
      dataUrl: "",
      isFinal: false,
      model: model.name,
      ratioLabel: ratio.label,
      styleName: style.name,
    }));
    setResults((r) => [...placeholders, ...r]);
    setGenerating(true);

    toast.success(`Generating ${n} image${n === 1 ? "" : "s"}…`, {
      description: `${model.name} · ${ratio.label} · ${style.name}`,
    });

    // Generate each variation in parallel; each streams partial frames into its card.
    const tasks = placeholders.map((ph, i) =>
      (async () => {
        try {
          let gotFrame = false;
          await streamImage("/api/generate-image", prompt, model.id, (dataUrl, isFinal) => {
            gotFrame = true;
            setResults((list) =>
              list.map((r) => (r.id === ph.id ? { ...r, dataUrl, isFinal } : r)),
            );
          });
          // Zero-event stream: replay once non-streaming to recover the image.
          if (!gotFrame) {
            await streamImage("/api/generate-image", prompt, model.id, (dataUrl, isFinal) => {
              setResults((list) =>
                list.map((r) => (r.id === ph.id ? { ...r, dataUrl, isFinal } : r)),
              );
            });
          }
        } catch (err) {
          setResults((list) =>
            list.map((r) =>
              r.id === ph.id
                ? {
                    ...r,
                    prompt: `Failed to generate (${err instanceof Error ? err.message : "error"})`,
                  }
                : r,
            ),
          );
        } finally {
          setGenerating((g) => (i === n - 1 ? false : g));
        }
      })(),
    );
    await Promise.all(tasks);
    setGenerating(false);
  };

  return (
    <div className="w-full">
      {/* Modality switcher */}
      <div className="mx-auto mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface/70 p-1 backdrop-blur-xl sm:w-fit [&::-webkit-scrollbar]:hidden">
        {modalities.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.label;
          return (
            <button
              key={m.label}
              type="button"
              onClick={() => {
                setActive(m.label);
                setModel((modelsByModality[m.label] ?? imageModels)[0]!);
              }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Composer */}
      <div className="ring-spectral shadow-glow rounded-3xl">
        <div className="glass rounded-3xl p-2.5 sm:p-3">
          {refs.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2 px-1.5 pt-1.5">
              {refs.map((r) => (
                <span
                  key={r.id}
                  className="group relative h-14 w-14 overflow-hidden rounded-xl border border-border"
                >
                  <img src={r.url} alt={r.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => setRefs((list) => list.filter((x) => x.id !== r.id))}
                    className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground"
                  >
                    <X className="h-3 w-3" strokeWidth={2.6} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-start gap-2.5 px-1.5 pt-1.5">
            <Sparkles className="mt-0.5 h-[18px] w-[18px] shrink-0 text-spectral-2" strokeWidth={2} />
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  generate();
                }
              }}
              rows={2}
              placeholder={`Describe the ${active.toLowerCase()} you want to generate…`}
              className="min-h-[52px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
            />
          </div>

          <div className="mt-2 flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <button
                type="button"
                aria-label="Add reference image"
                onClick={() => fileRef.current?.click()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2/70 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              </button>

              {/* Model */}
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <Chip icon={Wand2}>{model.name}</Chip>
                  </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-1.5">
                  <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Generative model
                  </p>
                  {models.map((m) => (
                    <OptionRow
                      key={m.id}
                      title={m.name}
                      note={m.note}
                      selected={m.id === model.id}
                      onClick={() => setModel(m)}
                    />
                  ))}
                  <p className="px-2.5 pb-1 pt-2 text-[11px] text-muted-foreground">
                    More models coming soon.
                  </p>
                </PopoverContent>
              </Popover>

              {/* Aspect ratio */}
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <Chip icon={Ratio}>{ratio.label}</Chip>
                  </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <p className="px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Aspect ratio
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ratios.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => setRatio(r)}
                        title={r.note}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors",
                          r.label === ratio.label
                            ? "border-border-strong bg-surface-2"
                            : "border-border hover:bg-surface-2",
                        )}
                      >
                        <span
                          className="rounded-[4px] border border-border-strong"
                          style={{
                            width: `${(r.w / Math.max(r.w, r.h)) * 26}px`,
                            height: `${(r.h / Math.max(r.w, r.h)) * 26}px`,
                          }}
                        />
                        <span className="text-[11px] font-semibold text-foreground">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Style */}
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <Chip icon={Sparkles} active={style.id === "heaven"}>
                      {style.name}
                    </Chip>
                  </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-1.5">
                  <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Style
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {styles.map((s) => (
                      <OptionRow
                        key={s.id}
                        title={s.name}
                        note={s.note}
                        accent={s.signature}
                        selected={s.id === style.id}
                        onClick={() => setStyle(s)}
                      />
                    ))}
                  </div>
                  <div className="mt-1 border-t border-border px-2.5 pb-1 pt-3">
                    <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-foreground">
                      <span>Style strength</span>
                      <span className="text-muted-foreground">{styleStrength[0]}%</span>
                    </div>
                    <Slider
                      value={styleStrength}
                      onValueChange={setStyleStrength}
                      max={100}
                      step={1}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {/* Advanced */}
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <Chip icon={SlidersHorizontal} active={modes.length > 0}>
                      {advancedLabel}
                    </Chip>
                  </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-1.5">
                  <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Advanced image controls
                  </p>
                  {advancedModes.map((m) => (
                    <OptionRow
                      key={m.id}
                      title={m.name}
                      note={m.note}
                      selected={modes.includes(m.id)}
                      onClick={() => toggleMode(m.id)}
                    />
                  ))}
                  <div className="mt-1 space-y-3 border-t border-border px-2.5 pb-1 pt-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-foreground">
                        <span>Variations</span>
                        <span className="text-muted-foreground">{count[0]}</span>
                      </div>
                      <Slider value={count} onValueChange={setCount} min={1} max={8} step={1} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-foreground">
                        Lock seed
                        <span className="ml-1.5 font-normal text-muted-foreground">#{seed}</span>
                      </span>
                      <Switch checked={seedLocked} onCheckedChange={setSeedLocked} />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full rounded-xl border border-border px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-2"
                    >
                      Upload image {refs.length ? `(${refs.length})` : ""}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

<Chip
                icon={Shuffle}
                caret={false}
                onClick={() => setValue(suggestions[Math.floor(Math.random() * suggestions.length)]!)}
              >
                Surprise me
              </Chip>
            </div>

            <button
              type="button"
              aria-label="Generate"
              onClick={generate}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.04] active:scale-95"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className="truncate rounded-full border border-border bg-surface/60 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {s}
          </button>
        ))}
</div>

      <ResultsGrid results={results} generating={generating} />
    </div>
  );
}

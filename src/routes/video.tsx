import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { StudioLayout } from "@/components/hyper/StudioLayout";
import { Chips, Panel, RatioBlocks, Segment, SliderRow, SwitchRow, TextRow } from "@/components/hyper/StudioControls";
import { RecentCreations } from "@/components/hyper/RecentCreations";
import { pollVideo, startVideo } from "@/lib/generation.functions";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Video Studio — AI Video Generation | Hyper Copilot" },
      {
        name: "description",
        content:
          "Create cinematic AI videos with Hyper Video Omni: aspect ratios, duration, camera motion, frame rate and soundtrack controls in Hyper Copilot's Video Studio.",
      },
      { property: "og:title", content: "Video Studio — AI Video Generation" },
      {
        property: "og:description",
        content: "Camera, motion, duration and soundtrack controls for production-grade AI video.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoStudio,
});

const models = ["Hyper Video Omni"] as const;
const ratios = ["16:9", "9:16", "1:1"] as const;
const resolutions = ["720p", "1080p", "4K"] as const;
const durations = ["4s", "6s", "8s"] as const;
const frameRates = ["24 fps", "30 fps", "60 fps"] as const;
const cameraMoves = ["Static", "Pan", "Tilt", "Dolly In", "Dolly Out", "Orbit", "Crane", "Handheld"] as const;
const styles = ["Cinematic", "Photoreal", "Anime", "3D Render", "Documentary", "Neon Noir"] as const;
const refModes = ["Start frame", "End frame", "Reference subject", "Style reference"] as const;

function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [model, setModel] = useState<(typeof models)[number]>(models[0]);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>(ratios[0]);
  const [res, setRes] = useState<(typeof resolutions)[number]>(resolutions[0]);
  const [duration, setDuration] = useState<(typeof durations)[number]>(durations[2]);
  const [fps, setFps] = useState<(typeof frameRates)[number]>(frameRates[0]);
  const [camera, setCamera] = useState<(typeof cameraMoves)[number]>(cameraMoves[0]);
  const [motion, setMotion] = useState(55);
  const [style, setStyle] = useState<(typeof styles)[number]>(styles[0]);
  const [styleStrength, setStyleStrength] = useState(60);
  const [modes, setModes] = useState<string[]>([]);
  const [audio, setAudio] = useState(true);
  const [seedLock, setSeedLock] = useState(false);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the scene you want to create first.");
      return;
    }
    setBusy(true);
    setClipUrl(null);
    toast.success("Generating video…", { description: "This can take a few minutes." });
    try {
      const seconds = Number(duration.replace("s", "")) || 6;
      const job = await startVideo({
        data: {
          prompt: `${prompt.trim()}, ${style.toLowerCase()} look, ${camera.toLowerCase()} camera move`,
          negative: negative.trim(),
          aspect: ratio,
          frames: Math.round(seconds * 24),
          frameRate: Number(fps.replace(" fps", "")) || 24,
        },
      });
      for (let i = 0; i < 120; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        const status = await pollVideo({ data: { id: job.id, requestId: job.requestId } });
        if (status.status === "completed") {
          setClipUrl(status.url ?? null);
          void queryClient.invalidateQueries({ queryKey: ["generations"] });
          toast.success("Video ready");
          return;
        }
        if (status.status === "failed") throw new Error(status.error ?? "Video generation failed");
      }
      throw new Error("Video generation timed out");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudioLayout>
      <div className="space-y-3.5">
        <div className="rounded-2xl border border-border bg-surface/50 p-3.5">
          <TextRow
            label="Prompt"
            value={prompt}
            onChange={setPrompt}
            rows={3}
            placeholder="A chrome heron gliding over a flooded cathedral at dusk, slow dolly in…"
          />
          <div className="mt-3.5">
            <TextRow
              label="Negative prompt"
              value={negative}
              onChange={setNegative}
              rows={2}
              placeholder="text overlays, watermark, jitter"
            />
          </div>
        </div>

        <Panel title="Model" summary={model}>
          <Segment options={models} value={model} onChange={setModel} />
        </Panel>

        <Panel title="Format" summary={`${ratio} · ${res} · ${duration} · ${fps}`}>
          <RatioBlocks label="Aspect ratio" options={ratios} value={ratio} onChange={setRatio} />
          <Segment label="Resolution" options={resolutions} value={res} onChange={setRes} />
          <Segment label="Duration" options={durations} value={duration} onChange={setDuration} />
          <Segment label="Frame rate" options={frameRates} value={fps} onChange={setFps} />
        </Panel>

        <Panel title="Motion & camera" summary={`${camera} · ${motion}% motion`}>
          <Segment label="Camera movement" options={cameraMoves} value={camera} onChange={setCamera} />
          <SliderRow label="Motion strength" value={motion} onChange={setMotion} suffix="%" />
        </Panel>

        <Panel title="Style" summary={`${style} · ${styleStrength}%`}>
          <Segment options={styles} value={style} onChange={setStyle} />
          <SliderRow label="Style strength" value={styleStrength} onChange={setStyleStrength} suffix="%" />
        </Panel>

        <Panel title="References" summary={modes.join(", ") || "None"}>
          <Chips
            options={refModes}
            values={modes}
            onToggle={(v) => setModes((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]))}
          />
        </Panel>

        <Panel title="Output" summary={`${count} clip${count === 1 ? "" : "s"}${audio ? " · soundtrack" : ""}`}>
          <SliderRow label="Variations" value={count} onChange={setCount} min={1} max={4} />
          <SwitchRow label="Generate soundtrack" checked={audio} onCheckedChange={setAudio} />
          <SwitchRow label="Lock seed" checked={seedLock} onCheckedChange={setSeedLock} />
        </Panel>

        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="w-full rounded-full bg-primary py-3 text-[14px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate"}
        </button>

        {clipUrl ? (
          <video
            src={clipUrl}
            controls
            playsInline
            className="w-full rounded-2xl border border-border bg-surface"
          />
        ) : null}

        <RecentCreations />
      </div>
    </StudioLayout>
  );
}

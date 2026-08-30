import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { StudioLayout } from "@/components/hyper/StudioLayout";
import { Chips, Panel, Segment, SliderRow, SwitchRow, TextRow } from "@/components/hyper/StudioControls";
import { RecentCreations } from "@/components/hyper/RecentCreations";
import { generateSpeech } from "@/lib/generation.functions";

export const Route = createFileRoute("/audio")({
  head: () => ({
    meta: [
      { title: "Audio Studio — AI Music & Sound Generation | Hyper Copilot" },
      {
        name: "description",
        content:
          "Compose AI music, voice and sound effects with Hyper Audio Omni: genre, tempo, vocals, duration and mixing controls in Hyper Copilot's Audio Studio.",
      },
      { property: "og:title", content: "Audio Studio — AI Music & Sound Generation" },
      {
        property: "og:description",
        content: "Genre, tempo, vocals and mixing controls for production-grade AI audio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AudioStudio,
});

const models = ["Hyper Audio Omni"] as const;
const kinds = ["Music", "Voiceover", "Sound FX", "Ambient"] as const;
const genres = ["Cinematic", "Electronic", "Lo-Fi", "Orchestral", "Hip-Hop", "Ambient", "Rock", "Jazz"] as const;
const moods = ["Epic", "Calm", "Dark", "Uplifting", "Melancholic", "Tense"] as const;
const durations = ["15s", "30s", "60s", "3 min"] as const;
const formats = ["WAV", "MP3", "FLAC"] as const;
const vocals = ["Warm", "Bright", "Deep", "Calm"] as const;
const voiceMap: Record<(typeof vocals)[number], string> = {
  Warm: "Kore",
  Bright: "Puck",
  Deep: "Charon",
  Calm: "Aoede",
};

function AudioStudio() {
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [model, setModel] = useState<(typeof models)[number]>(models[0]);
  const [kind, setKind] = useState<(typeof kinds)[number]>(kinds[0]);
  const [genre, setGenre] = useState<(typeof genres)[number]>(genres[0]);
  const [mood, setMood] = useState<(typeof moods)[number]>(moods[0]);
  const [tempo, setTempo] = useState(120);
  const [duration, setDuration] = useState<(typeof durations)[number]>(durations[1]);
  const [vocal, setVocal] = useState<(typeof vocals)[number]>(vocals[0]);
  const [format, setFormat] = useState<(typeof formats)[number]>(formats[0]);
  const [instrumental, setInstrumental] = useState(false);
  const [loop, setLoop] = useState(false);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const generate = async () => {
    const script = (lyrics.trim() || prompt.trim()).trim();
    if (!script) {
      toast.error("Write the script or prompt you want spoken first.");
      return;
    }
    if (kind !== "Voiceover") {
      toast.info("Music and sound effects are coming soon.", {
        description: "Hyper Audio Omni currently generates speech. Switch Type to Voiceover.",
      });
      return;
    }
    setBusy(true);
    setTrackUrl(null);
    try {
      const res = await generateSpeech({ data: { text: script, voice: voiceMap[vocal] } });
      setTrackUrl(res.url ?? null);
      void queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Speech ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speech generation failed");
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
            placeholder="A brooding synthwave score with analog arpeggios building to a soaring chorus…"
          />
          <div className="mt-3.5">
            <TextRow
              label="Lyrics / script (optional)"
              value={lyrics}
              onChange={setLyrics}
              rows={2}
              placeholder="Add lyrics for songs or a script for voiceover…"
            />
          </div>
        </div>

        <Panel title="Model" summary={model}>
          <Segment options={models} value={model} onChange={setModel} />
        </Panel>

        <Panel title="Type" summary={kind}>
          <Segment options={kinds} value={kind} onChange={setKind} />
        </Panel>

        <Panel title="Style" summary={`${genre} · ${mood}`}>
          <Segment label="Genre" options={genres} value={genre} onChange={setGenre} />
          <Chips
            label="Mood"
            options={moods}
            values={[mood]}
            onToggle={(v) => setMood(v as (typeof moods)[number])}
          />
        </Panel>

        <Panel title="Composition" summary={`${tempo} BPM · ${duration}`}>
          <SliderRow label="Tempo" value={tempo} onChange={setTempo} min={40} max={220} suffix=" BPM" />
          <Segment label="Duration" options={durations} value={duration} onChange={setDuration} />
        </Panel>

        <Panel title="Voice" summary={instrumental ? "Instrumental" : vocal}>
          <Segment options={vocals} value={vocal} onChange={setVocal} />
          <SwitchRow label="Instrumental only" checked={instrumental} onCheckedChange={setInstrumental} />
        </Panel>

        <Panel title="Output" summary={`${format} · ${count} track${count === 1 ? "" : "s"}`}>
          <Segment label="Format" options={formats} value={format} onChange={setFormat} />
          <SliderRow label="Variations" value={count} onChange={setCount} min={1} max={4} />
          <SwitchRow label="Seamless loop" checked={loop} onCheckedChange={setLoop} />
        </Panel>

        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="w-full rounded-full bg-primary py-3 text-[14px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate"}
        </button>

        {trackUrl ? (
          <audio src={trackUrl} controls className="w-full rounded-full border border-border bg-surface" />
        ) : null}

        <RecentCreations />
      </div>
    </StudioLayout>
  );
}

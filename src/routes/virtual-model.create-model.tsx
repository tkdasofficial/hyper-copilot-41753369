import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { StudioLayout } from "@/components/hyper/StudioLayout";
import { Chips, Panel, Segment, SliderRow, TextRow } from "@/components/hyper/StudioControls";
import { createVirtualModel } from "@/lib/virtual-model.functions";

export const Route = createFileRoute("/virtual-model/create-model")({
  head: () => ({
    meta: [
      { title: "Create Model — AI Character Builder | Hyper Copilot" },
      {
        name: "description",
        content:
          "Build a reusable AI character: age, height, body, render style, skin tone, eyes, hair and face traits with top-tier consistency.",
      },
      { property: "og:title", content: "Create Model — AI Character Builder" },
      {
        property: "og:description",
        content: "Define a consistent AI influencer identity from A to Z.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateModel,
});

const genders = ["Female", "Male", "Androgynous"] as const;
const bodyTypes = ["Slim", "Athletic", "Curvy", "Plus", "Muscular"] as const;
const styleModes = ["Realistic", "Cinematic", "Editorial", "Cartoon", "Anime", "3D", "HEAVEN"] as const;
const eyeColors = ["Brown", "Hazel", "Amber", "Green", "Blue", "Grey"] as const;
const hairStyles = ["Long", "Wavy", "Curly", "Bob", "Pixie", "Braids", "Ponytail", "Buzz"] as const;
const hairColors = ["Black", "Brown", "Blonde", "Auburn", "Red", "Platinum", "Blue"] as const;
const skinTones = ["I", "II", "III", "IV", "V", "VI"] as const;
const ethnicities = ["Global", "East Asian", "South Asian", "African", "Latina", "Middle Eastern", "European"] as const;
const faceTraits = ["Freckles", "Dimples", "Sharp jawline", "Soft cheeks", "Beauty mark", "Full lips"];

function CreateModel() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<(typeof genders)[number]>(genders[0]);
  const [age, setAge] = useState(24);
  const [height, setHeight] = useState(172);
  const [body, setBody] = useState<(typeof bodyTypes)[number]>(bodyTypes[1]);
  const [styleMode, setStyleMode] = useState<(typeof styleModes)[number]>(styleModes[0]);
  const [eye, setEye] = useState<(typeof eyeColors)[number]>(eyeColors[0]);
  const [hair, setHair] = useState<(typeof hairStyles)[number]>(hairStyles[0]);
  const [hairColor, setHairColor] = useState<(typeof hairColors)[number]>(hairColors[0]);
  const [skin, setSkin] = useState<(typeof skinTones)[number]>(skinTones[2]);
  const [ethnicity, setEthnicity] = useState<(typeof ethnicities)[number]>(ethnicities[0]);
  const [traits, setTraits] = useState<string[]>([]);
  const [persona, setPersona] = useState("");
  const queryClient = useQueryClient();

  const identityPrompt = () =>
    [
      `${styleMode.toLowerCase()} portrait of a ${age} year old ${gender.toLowerCase()} fashion model`,
      `${ethnicity.toLowerCase()} features`,
      `Fitzpatrick skin tone ${skin}`,
      `${eye.toLowerCase()} eyes`,
      `${hairColor.toLowerCase()} ${hair.toLowerCase()} hair`,
      `${body.toLowerCase()} build`,
      `${height} cm tall`,
      traits.length ? traits.join(", ").toLowerCase() : "",
      persona.trim(),
    ]
      .filter(Boolean)
      .join(", ");

  const create = useMutation({
    mutationFn: () =>
      createVirtualModel({
        data: {
          name: name.trim() || "New model",
          description: `${gender} · ${age} · ${height}cm · ${body} · ${styleMode}`,
          identityPrompt: identityPrompt(),
        },
      }),
    onSuccess: () => {
      toast.success(`${name.trim() || "New model"} created`, {
        description: "Six profile views generated.",
      });
      void queryClient.invalidateQueries({ queryKey: ["virtual-models"] });
      void navigate({ to: "/virtual-model" });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not create the model"),
  });

  return (
    <StudioLayout>
      <div className="space-y-3.5">
        <div className="rounded-2xl border border-border bg-surface/50 p-3.5">
          <TextRow label="Model name" value={name} onChange={setName} rows={1} placeholder="e.g. Aya Nakamura" />
        </div>

        <Panel title="Identity" summary={`${gender} · ${age} · ${height}cm · ${body}`} defaultOpen>
          <Segment label="Presentation" options={genders} value={gender} onChange={setGender} />
          <SliderRow label="Age" value={age} onChange={setAge} min={18} max={70} />
          <SliderRow label="Height" value={height} onChange={setHeight} min={145} max={205} suffix=" cm" />
          <Segment label="Body type" options={bodyTypes} value={body} onChange={setBody} />
        </Panel>

        <Panel title="Render style" summary={styleMode}>
          <Segment label="Style" options={styleModes} value={styleMode} onChange={setStyleMode} />
        </Panel>

        <Panel title="Face & skin" summary={`${ethnicity} · ${skin} · ${eye} eyes`}>
          <Segment label="Ethnic features" options={ethnicities} value={ethnicity} onChange={setEthnicity} />
          <Segment label="Skin tone" options={skinTones} value={skin} onChange={setSkin} />
          <Segment label="Eye color" options={eyeColors} value={eye} onChange={setEye} />
          <Chips label="Face traits" options={faceTraits} values={traits} onToggle={(v) =>
            setTraits((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))
          } />
        </Panel>

        <Panel title="Hair" summary={`${hair} · ${hairColor}`}>
          <Segment label="Style" options={hairStyles} value={hair} onChange={setHair} />
          <Segment label="Color" options={hairColors} value={hairColor} onChange={setHairColor} />
        </Panel>

        <Panel title="Persona" summary={persona ? "Set" : "Optional"}>
          <TextRow
            label="Persona & bio"
            value={persona}
            onChange={setPersona}
            rows={3}
            placeholder="Tokyo-based streetwear creator, warm and playful…"
          />
        </Panel>

        <button
          type="button"
          disabled={create.isPending}
          onClick={() => {
            if (!name.trim()) {
              toast.error("Give your model a name first.");
              return;
            }
            toast.info("Generating the six-view character profile…", {
              description: "This takes a minute.",
            });
            create.mutate();
          }}
          className="w-full rounded-full bg-primary py-2.5 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create model"}
        </button>
      </div>
    </StudioLayout>
  );
}

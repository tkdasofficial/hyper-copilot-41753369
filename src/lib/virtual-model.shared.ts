/** Prompt building blocks and consistency math for character (virtual model) generation. */

export type VirtualModelImage = { view: string; path: string };

export type VirtualModelRecord = {
  id: string;
  name: string;
  description: string;
  identityPrompt: string;
  seed: number;
  status: string;
  error: string | null;
  headshotUrl: string | null;
  images: { view: string; url: string | null }[];
  createdAt: string;
};

export type ViewId =
  | "headshot"
  | "three-quarter"
  | "front-full"
  | "back-full"
  | "left-profile"
  | "right-profile";

/**
 * The six profile views generated for every character.
 *
 * `reference` declares which already-rendered view conditions this one:
 * - `null`  — the anchor, rendered from text so the identity is born once.
 * - `headshot`   — portrait framings inherit the face directly from the anchor.
 * - `front-full` — body framings inherit head-to-toe proportions from the
 *   front full body render, which itself inherits the anchor's face.
 */
export const MODEL_VIEWS: {
  id: ViewId;
  label: string;
  instruction: string;
  reference: ViewId | null;
  portrait: boolean;
}[] = [
  {
    id: "headshot",
    label: "Headshot",
    instruction:
      "tight headshot portrait, head and shoulders only, face perfectly centered and fully visible, neutral relaxed expression, eyes looking straight into the camera, symmetrical framing",
    reference: null,
    portrait: true,
  },
  {
    id: "front-full",
    label: "Front full body",
    instruction:
      "full body shot from the front, standing straight in a neutral A-pose, arms relaxed at the sides, feet together, entire figure visible from head to feet with the whole face clearly visible",
    reference: "headshot",
    portrait: false,
  },
  {
    id: "three-quarter",
    label: "Three-quarter",
    instruction:
      "three-quarter portrait from the chest up, head turned 45 degrees to the camera, same neutral expression",
    reference: "headshot",
    portrait: true,
  },
  {
    id: "back-full",
    label: "Back full body",
    instruction:
      "full body shot from directly behind, standing straight, head facing away from the camera, entire figure visible from head to feet, same hair length and body silhouette",
    reference: "front-full",
    portrait: false,
  },
  {
    id: "left-profile",
    label: "Left side",
    instruction:
      "full body shot from the left side, exact 90 degree left profile view, standing straight, entire figure visible from head to feet",
    reference: "front-full",
    portrait: false,
  },
  {
    id: "right-profile",
    label: "Right side",
    instruction:
      "full body shot from the right side, exact 90 degree right profile view, standing straight, entire figure visible from head to feet",
    reference: "front-full",
    portrait: false,
  },
];

/** Non-negotiable identity clause repeated verbatim in every request. */
export const IDENTITY_LOCK =
  "one single consistent person, identical face in every frame, exact same facial bone structure and jawline, same eye shape and iris color, same nose shape, same lip shape, same eyebrow shape, same skin tone and skin texture with the same freckles and marks, same hairline, hair length, hair texture and hair color, same body proportions, same height and same build";

/** Studio conditions that keep the reference set comparable frame to frame. */
export const STUDIO_SUFFIX =
  "plain light grey seamless studio backdrop, even soft diffused studio lighting with no harsh shadows, fitted plain neutral grey outfit, full colour photograph, photorealistic, ultra detailed natural skin texture, sharp focus, high dynamic range, 85mm lens, shot on a full frame camera";

export const IDENTITY_NEGATIVE =
  "different person, another person, changing face, face swap, inconsistent features, multiple people, twins, deformed face, asymmetric eyes, extra fingers, extra limbs, missing limbs, mutated hands, cropped head, cut off feet, blurry, out of focus, lowres, low quality, jpeg artifacts, plastic skin, waxy skin, uncanny, horror, creepy, watermark, text, logo, signature, collage, split image, distorted proportions";

export function viewPrompt(identityPrompt: string, instruction: string) {
  return `${identityPrompt}. ${instruction}. ${IDENTITY_LOCK}. ${STUDIO_SUFFIX}`;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Maps a 0-100 identity-consistency dial onto sampler settings.
 *
 * Higher consistency means more sampling steps, stronger prompt adherence and
 * a lower denoise strength, so image-to-image passes stay closer to the
 * reference face instead of drifting into a new person.
 */
export function consistencyProfile(level = 92) {
  const c = clamp(level, 40, 100) / 100;
  return {
    steps: Math.round(26 + c * 22),
    guidance: Number((6.5 + c * 4).toFixed(2)),
    strength: Number((0.9 - c * 0.45).toFixed(2)),
  };
}

/** Deterministic per-view seed so a rerun reproduces the same profile set. */
export function viewSeed(seed: number, viewId: string) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < viewId.length; i++) {
    h = Math.imul(h ^ viewId.charCodeAt(i), 16777619);
  }
  return Math.abs(h) % 1_000_000_000;
}

/** Picks the profile view that best conditions a requested shot framing. */
export function referenceViewForShot(shot?: string): ViewId {
  const s = (shot ?? "").toLowerCase();
  if (s.includes("close")) return "headshot";
  if (s.includes("portrait")) return "headshot";
  if (s.includes("half")) return "three-quarter";
  if (s.includes("full") || s.includes("wide")) return "front-full";
  return "headshot";
}

/** Identity clause appended to every character render request. */
export function renderPrompt(input: {
  identityPrompt: string;
  prompt: string;
  faceLock: boolean;
  detail: number;
}) {
  const detail = clamp(input.detail, 0, 100);
  const detailClause =
    detail >= 80
      ? "extremely fine micro detail, visible skin pores, individual hair strands, crisp fabric weave"
      : detail >= 50
        ? "rich natural detail, realistic skin texture"
        : "soft natural detail";
  return [
    input.identityPrompt,
    input.prompt,
    input.faceLock
      ? "the face must be pixel-faithful to the reference person, do not alter the facial identity in any way"
      : "keep the same person as the reference",
    IDENTITY_LOCK,
    detailClause,
    "full colour photograph, photorealistic, professional editorial quality",
  ]
    .filter(Boolean)
    .join(". ");
}

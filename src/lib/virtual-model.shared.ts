/** Prompt building blocks for character (virtual model) generation. */

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

/** The six profile views generated for every character, in order. */
export const MODEL_VIEWS = [
  {
    id: "headshot",
    label: "Headshot",
    instruction:
      "tight headshot portrait, face centered, neutral expression, looking straight into the camera",
  },
  {
    id: "three-quarter",
    label: "Three-quarter",
    instruction: "three-quarter portrait from the chest up, head turned 45 degrees",
  },
  {
    id: "front-full",
    label: "Front full body",
    instruction:
      "full body shot from the front, standing straight, arms relaxed at the sides, entire figure visible head to feet",
  },
  {
    id: "back-full",
    label: "Back full body",
    instruction:
      "full body shot from directly behind, standing straight, entire figure visible head to feet",
  },
  {
    id: "left-profile",
    label: "Left side",
    instruction: "full body shot from the left side, exact left profile view",
  },
  {
    id: "right-profile",
    label: "Right side",
    instruction: "full body shot from the right side, exact right profile view",
  },
] as const;

export const CONSISTENCY_SUFFIX =
  "identical person in every frame, exact same facial structure, same bone structure, same eye shape and color, same nose, same lips, same skin tone and texture, same hairline and hair, same body proportions and height, plain light grey seamless studio backdrop, even soft studio lighting, fitted neutral grey outfit, photorealistic, ultra detailed skin, sharp focus, 85mm lens";

export const IDENTITY_NEGATIVE =
  "different person, changing face, deformed face, extra fingers, extra limbs, blurry, low quality, watermark, text, logo, distorted proportions";

export function viewPrompt(identityPrompt: string, instruction: string) {
  return `${identityPrompt}. ${instruction}. ${CONSISTENCY_SUFFIX}`;
}

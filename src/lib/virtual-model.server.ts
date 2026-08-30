/** Server-only character generation pipeline. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pixazoStableDiffusion, sizeForAspect } from "@/lib/providers.server";
import {
  GENERATIONS_BUCKET,
  MODELS_BUCKET,
  signedUrl,
  uploadFromUrl,
} from "@/lib/storage.server";
import {
  IDENTITY_NEGATIVE,
  MODEL_VIEWS,
  viewPrompt,
  type VirtualModelImage,
} from "@/lib/virtual-model.shared";

export async function buildCharacterProfile(
  userId: string,
  input: { name: string; description: string; identityPrompt: string; seed?: number | undefined },
) {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);

  const { data: row, error } = await supabaseAdmin
    .from("virtual_models")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      identity_prompt: input.identityPrompt,
      seed,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const images: VirtualModelImage[] = [];
  let referenceUrl: string | undefined;

  try {
    for (const view of MODEL_VIEWS) {
      const isPortrait = view.id === "headshot" || view.id === "three-quarter";
      const providerUrl = await pixazoStableDiffusion({
        prompt: viewPrompt(input.identityPrompt, view.instruction),
        negativePrompt: IDENTITY_NEGATIVE,
        width: isPortrait ? 768 : 704,
        height: isPortrait ? 768 : 1024,
        seed,
        steps: 20,
        guidance: 8,
        // Every view after the headshot is conditioned on it, so the face and
        // body structure stay locked to the same person.
        imageUrl: referenceUrl,
      });
      const path = await uploadFromUrl(MODELS_BUCKET, userId, providerUrl);
      images.push({ view: view.id, path });
      if (!referenceUrl) {
        referenceUrl = (await signedUrl(MODELS_BUCKET, path)) ?? undefined;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Character generation failed";
    await supabaseAdmin
      .from("virtual_models")
      .update({ status: "failed", error: message, images })
      .eq("id", row.id);
    throw new Error(message);
  }

  await supabaseAdmin
    .from("virtual_models")
    .update({ status: "ready", images, headshot_path: images[0]?.path ?? null })
    .eq("id", row.id);

  return { id: row.id };
}

export async function renderCharacterImage(
  userId: string,
  input: {
    modelId: string;
    identityPrompt: string;
    seed: number;
    headshotPath: string | null;
    prompt: string;
    negativePrompt?: string | undefined;
    aspect?: string | undefined;
  },
) {
  const reference = input.headshotPath
    ? await signedUrl(MODELS_BUCKET, input.headshotPath)
    : null;
  const { width, height } = sizeForAspect(input.aspect ?? "4:5");

  const providerUrl = await pixazoStableDiffusion({
    prompt: `${input.identityPrompt}. ${input.prompt}. Keep the exact same face, bone structure and body proportions as the reference person, photorealistic, ultra detailed`,
    negativePrompt: input.negativePrompt || IDENTITY_NEGATIVE,
    imageUrl: reference ?? undefined,
    width,
    height,
    seed: input.seed,
    steps: 20,
    guidance: 8,
  });

  const path = await uploadFromUrl(GENERATIONS_BUCKET, userId, providerUrl);
  const { data: row, error } = await supabaseAdmin
    .from("generations")
    .insert({
      user_id: userId,
      kind: "image",
      model: "hyper-image-flash",
      prompt: input.prompt,
      status: "completed",
      storage_path: path,
      virtual_model_id: input.modelId,
      params: { aspect: input.aspect ?? "4:5" },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { id: row.id, url: await signedUrl(GENERATIONS_BUCKET, path) };
}

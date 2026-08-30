/** Server-only character generation pipeline. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pixazoImage, sizeForAspect } from "@/lib/providers.server";
import {
  GENERATIONS_BUCKET,
  MODELS_BUCKET,
  signedUrl,
  uploadFromUrl,
} from "@/lib/storage.server";
import {
  consistencyProfile,
  IDENTITY_NEGATIVE,
  MODEL_VIEWS,
  referenceViewForShot,
  renderPrompt,
  viewPrompt,
  viewSeed,
  type ViewId,
  type VirtualModelImage,
} from "@/lib/virtual-model.shared";

const PORTRAIT_SIZE = { width: 768, height: 960 };
const BODY_SIZE = { width: 704, height: 1216 };

/**
 * Builds a character profile as a dependency chain instead of six independent
 * renders:
 *
 *   headshot (text-to-image anchor)
 *     -> front full body (inherits the face)
 *          -> back / left / right (inherit face + body silhouette)
 *     -> three-quarter portrait (inherits the face)
 *
 * Every render reuses the same identity clause, a deterministic per-view seed
 * and a low denoise strength derived from the consistency dial, so the face and
 * body structure hold across the whole set.
 */
export async function buildCharacterProfile(
  userId: string,
  input: {
    name: string;
    description: string;
    identityPrompt: string;
    seed?: number | undefined;
    consistency?: number | undefined;
  },
) {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const profile = consistencyProfile(input.consistency ?? 92);

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
  const paths = new Map<ViewId, string>();
  const refUrls = new Map<ViewId, string>();

  const renderView = async (view: (typeof MODEL_VIEWS)[number]) => {
    const size = view.portrait ? PORTRAIT_SIZE : BODY_SIZE;
    const reference = view.reference ? refUrls.get(view.reference) : undefined;
    const providerUrl = await pixazoImage({
      prompt: viewPrompt(input.identityPrompt, view.instruction),
      negativePrompt: IDENTITY_NEGATIVE,
      width: size.width,
      height: size.height,
      seed: viewSeed(seed, view.id),
      steps: profile.steps,
      guidance: profile.guidance,
      ...(reference ? { imageUrl: reference, strength: profile.strength } : {}),
    });

    const path = await uploadFromUrl(MODELS_BUCKET, userId, providerUrl);
    paths.set(view.id, path);
    const url = await signedUrl(MODELS_BUCKET, path);
    if (url) refUrls.set(view.id, url);
    return path;
  };

  const byId = (id: ViewId) => MODEL_VIEWS.find((v) => v.id === id)!;

  try {
    // Stage 1 — the anchor identity.
    await renderView(byId("headshot"));
    // Stage 2 — the body reference, conditioned on the anchor face.
    await renderView(byId("front-full"));
    // Stage 3 — every remaining view can now run in parallel off its reference.
    await Promise.all(
      MODEL_VIEWS.filter((v) => v.id !== "headshot" && v.id !== "front-full").map(renderView),
    );

    for (const view of MODEL_VIEWS) {
      const path = paths.get(view.id);
      if (path) images.push({ view: view.id, path });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Character generation failed";
    for (const view of MODEL_VIEWS) {
      const path = paths.get(view.id);
      if (path) images.push({ view: view.id, path });
    }
    await supabaseAdmin
      .from("virtual_models")
      .update({ status: "failed", error: message, images })
      .eq("id", row.id);
    throw new Error(message);
  }

  await supabaseAdmin
    .from("virtual_models")
    .update({
      status: "ready",
      images,
      headshot_path: paths.get("headshot") ?? images[0]?.path ?? null,
    })
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
    images?: VirtualModelImage[] | undefined;
    prompt: string;
    negativePrompt?: string | undefined;
    aspect?: string | undefined;
    shot?: string | undefined;
    consistency?: number | undefined;
    detail?: number | undefined;
    faceLock?: boolean | undefined;
    variation?: number | undefined;
  },
) {
  // Condition on the profile view that matches the requested framing, so a full
  // body shot inherits proportions and a close-up inherits the face.
  const wanted = referenceViewForShot(input.shot);
  const available = input.images ?? [];
  const referencePath =
    available.find((i) => i.view === wanted)?.path ??
    available.find((i) => i.view === "headshot")?.path ??
    input.headshotPath ??
    available[0]?.path ??
    null;

  const reference = referencePath ? await signedUrl(MODELS_BUCKET, referencePath) : null;
  const { width, height } = sizeForAspect(input.aspect ?? "4:5");
  const faceLock = input.faceLock ?? true;
  const profile = consistencyProfile(input.consistency ?? 92);
  const variation = input.variation ?? 0;

  const providerUrl = await pixazoImage({
    prompt: renderPrompt({
      identityPrompt: input.identityPrompt,
      prompt: input.prompt,
      faceLock,
      detail: input.detail ?? 85,
    }),
    negativePrompt: [input.negativePrompt, IDENTITY_NEGATIVE].filter(Boolean).join(", "),
    ...(reference
      ? {
          imageUrl: reference,
          // A locked face keeps the denoise even tighter than the dial alone.
          strength: faceLock ? Math.min(profile.strength, 0.45) : profile.strength,
        }
      : {}),
    width,
    height,
    // Same identity seed, offset per variation so a batch differs in pose and
    // framing without becoming a different person.
    seed: viewSeed(input.seed, `render-${variation}`),
    steps: profile.steps,
    guidance: profile.guidance,
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
      params: {
        aspect: input.aspect ?? "4:5",
        referenceView: available.some((i) => i.path === referencePath) ? wanted : "headshot",
        consistency: input.consistency ?? 92,
        faceLock,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { id: row.id, url: await signedUrl(GENERATIONS_BUCKET, path) };
}

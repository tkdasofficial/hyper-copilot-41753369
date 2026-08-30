import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  { id: "headshot", instruction: "tight headshot portrait, face centered, neutral expression, looking straight into the camera" },
  { id: "three-quarter", instruction: "three-quarter portrait from the chest up, head turned 45 degrees" },
  { id: "front-full", instruction: "full body shot from the front, standing straight, arms relaxed at the sides, full figure visible head to feet" },
  { id: "back-full", instruction: "full body shot from directly behind, standing straight, full figure visible head to feet" },
  { id: "left-profile", instruction: "full body shot from the left side, exact left profile view" },
  { id: "right-profile", instruction: "full body shot from the right side, exact right profile view" },
] as const;

const CONSISTENCY_SUFFIX =
  "identical person in every frame, exact same facial structure, same bone structure, same eye shape and color, same nose, same lips, same skin tone and texture, same hairline and hair, same body proportions and height, plain light grey seamless studio backdrop, even soft studio lighting, fitted neutral grey outfit, photorealistic, ultra detailed skin, sharp focus, 85mm lens";

const NEGATIVE =
  "different person, changing face, deformed face, extra fingers, extra limbs, blurry, low quality, watermark, text, logo, distorted proportions";

function viewPrompt(identityPrompt: string, instruction: string) {
  return `${identityPrompt}. ${instruction}. ${CONSISTENCY_SUFFIX}`;
}

/** Creates a character and generates its six-view profile with a locked seed. */
export const createVirtualModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; description: string; identityPrompt: string; seed?: number }) => input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const seed = data.seed ?? Math.floor(Math.random() * 1_000_000);

    const { data: row, error } = await supabaseAdmin
      .from("virtual_models")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description,
        identity_prompt: data.identityPrompt,
        seed,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const images: VirtualModelImage[] = [];
    try {
      for (const view of MODEL_VIEWS) {
        const isPortrait = view.id === "headshot" || view.id === "three-quarter";
        const url = await providers.pixazoStableDiffusion({
          prompt: viewPrompt(data.identityPrompt, view.instruction),
          negativePrompt: NEGATIVE,
          width: isPortrait ? 768 : 704,
          height: isPortrait ? 768 : 1024,
          seed,
          steps: 20,
          guidance: 8,
          // Every view after the first is conditioned on the headshot so the
          // face and body structure stay locked to the same person.
          imageUrl: images.length > 0 ? url0(images) : undefined,
        });
        const path = await storage.uploadFromUrl(storage.MODELS_BUCKET, context.userId, url);
        images.push({ view: view.id, path });
        // Keep the provider-side reference URL for the following views.
        if (images.length === 1) referenceUrls.set(row.id, await headshotReference(path));
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
      .update({
        status: "ready",
        images,
        headshot_path: images[0]?.path ?? null,
      })
      .eq("id", row.id);

    return { id: row.id };

    // helpers scoped to this handler
    function url0(list: VirtualModelImage[]) {
      return referenceUrls.get(row.id) ?? undefined;
    }
    async function headshotReference(path: string) {
      return (await storage.signedUrl(storage.MODELS_BUCKET, path)) ?? "";
    }
  });

/** Signed reference URLs for in-flight character generations. */
const referenceUrls = new Map<string, string>();

export const listVirtualModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VirtualModelRecord[]> => {
    const storage = await import("@/lib/storage.server");
    const { data: rows, error } = await context.supabase
      .from("virtual_models")
      .select(
        "id, name, description, identity_prompt, seed, status, error, headshot_path, images, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const all = (rows ?? []).flatMap((r) =>
      ((r.images as VirtualModelImage[] | null) ?? []).map((i) => i.path),
    );
    const urls = await storage.signedUrls(storage.MODELS_BUCKET, all);

    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      identityPrompt: r.identity_prompt,
      seed: Number(r.seed),
      status: r.status,
      error: r.error,
      headshotUrl: r.headshot_path ? (urls[r.headshot_path] ?? null) : null,
      images: ((r.images as VirtualModelImage[] | null) ?? []).map((i) => ({
        view: i.view,
        url: urls[i.path] ?? null,
      })),
      createdAt: r.created_at,
    }));
  });

export const deleteVirtualModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const storage = await import("@/lib/storage.server");
    const { data: row } = await context.supabase
      .from("virtual_models")
      .select("images")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("virtual_models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const paths = ((row?.images as VirtualModelImage[] | null) ?? []).map((i) => i.path);
    await storage.removeFiles(storage.MODELS_BUCKET, paths);
    return { ok: true };
  });

/** Generates a new image of an existing character, conditioned on its headshot. */
export const generateWithVirtualModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { modelId: string; prompt: string; negativePrompt?: string; aspect?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: model, error: modelError } = await context.supabase
      .from("virtual_models")
      .select("id, identity_prompt, seed, headshot_path")
      .eq("id", data.modelId)
      .single();
    if (modelError) throw new Error(modelError.message);

    const reference = model.headshot_path
      ? await storage.signedUrl(storage.MODELS_BUCKET, model.headshot_path)
      : null;

    const { width, height } = providers.sizeForAspect(data.aspect ?? "4:5");
    const url = await providers.pixazoStableDiffusion({
      prompt: `${model.identity_prompt}. ${data.prompt}. Keep the exact same face, bone structure and body proportions as the reference person, photorealistic, ultra detailed`,
      negativePrompt: data.negativePrompt || NEGATIVE,
      imageUrl: reference ?? undefined,
      width,
      height,
      seed: Number(model.seed),
      steps: 20,
      guidance: 8,
    });

    const path = await storage.uploadFromUrl(storage.GENERATIONS_BUCKET, context.userId, url);
    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: context.userId,
        kind: "image",
        model: "hyper-image-flash",
        prompt: data.prompt,
        status: "completed",
        storage_path: path,
        virtual_model_id: model.id,
        params: { aspect: data.aspect ?? "4:5" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, url: await storage.signedUrl(storage.GENERATIONS_BUCKET, path) };
  });

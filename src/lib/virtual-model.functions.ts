import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VirtualModelImage, VirtualModelRecord } from "@/lib/virtual-model.shared";

/** Creates a character and generates its six-view profile with a locked seed. */
export const createVirtualModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      description: string;
      identityPrompt: string;
      seed?: number;
      consistency?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { buildCharacterProfile } = await import("@/lib/virtual-model.server");
    return buildCharacterProfile(context.userId, data);
  });


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
    const { renderCharacterImage } = await import("@/lib/virtual-model.server");
    const { data: model, error } = await context.supabase
      .from("virtual_models")
      .select("id, identity_prompt, seed, headshot_path")
      .eq("id", data.modelId)
      .single();
    if (error) throw new Error(error.message);

    return renderCharacterImage(context.userId, {
      modelId: model.id,
      identityPrompt: model.identity_prompt,
      seed: Number(model.seed),
      headshotPath: model.headshot_path,
      prompt: data.prompt,
      ...(data.negativePrompt === undefined ? {} : { negativePrompt: data.negativePrompt }),
      ...(data.aspect === undefined ? {} : { aspect: data.aspect }),
    });
  });

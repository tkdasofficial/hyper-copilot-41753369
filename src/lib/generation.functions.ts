import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GenerationKind = "image" | "video" | "audio";

export type GenerationRecord = {
  id: string;
  kind: GenerationKind;
  model: string;
  prompt: string;
  status: string;
  url: string | null;
  error: string | null;
  createdAt: string;
};

/** Uploads a browser file (as a data URL) so providers can read it over HTTPS. */
export const uploadReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const { dataUrlToBytes, uploadBytes, signedUrl, GENERATIONS_BUCKET } = await import(
      "@/lib/storage.server"
    );
    const { bytes, contentType } = dataUrlToBytes(data.dataUrl);
    const path = await uploadBytes(GENERATIONS_BUCKET, context.userId, bytes, contentType);
    return { path, url: await signedUrl(GENERATIONS_BUCKET, path) };
  });

/** Text-to-image and image-to-image across all Hyper image models. */
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      model: string;
      aspect?: string;
      seed?: number;
      negativePrompt?: string;
      referenceUrls?: string[];
      virtualModelId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const aspect = data.aspect ?? "1:1";
    const { width, height } = providers.sizeForAspect(aspect);
    const refs = (data.referenceUrls ?? []).filter(Boolean);

    let storagePath: string;
    try {
      if (data.model === "hyper-image-quality") {
        const dataUrl = await providers.lovableGeminiImage({
          prompt: data.prompt,
          imageUrls: refs,
        });
        const { bytes, contentType } = storage.dataUrlToBytes(dataUrl);
        storagePath = await storage.uploadBytes(
          storage.GENERATIONS_BUCKET,
          context.userId,
          bytes,
          contentType,
        );
      } else if (data.model === "hyper-image-speed") {
        const url = await providers.pixazoFluxSchnell({
          prompt: data.prompt,
          width,
          height,
          seed: data.seed,
        });
        storagePath = await storage.uploadFromUrl(
          storage.GENERATIONS_BUCKET,
          context.userId,
          url,
        );
      } else {
        const url = await providers.pixazoImage({
          prompt: data.prompt,
          width,
          height,
          seed: data.seed,
          negativePrompt: data.negativePrompt,
          imageUrl: refs[0],
        });
        storagePath = await storage.uploadFromUrl(
          storage.GENERATIONS_BUCKET,
          context.userId,
          url,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      await supabaseAdmin.from("generations").insert({
        user_id: context.userId,
        kind: "image",
        model: data.model,
        prompt: data.prompt,
        status: "failed",
        error: message,
        params: { aspect },
      });
      throw new Error(message);
    }

    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: context.userId,
        kind: "image",
        model: data.model,
        prompt: data.prompt,
        status: "completed",
        storage_path: storagePath,
        params: { aspect, seed: data.seed ?? null },
        virtual_model_id: data.virtualModelId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      url: await storage.signedUrl(storage.GENERATIONS_BUCKET, storagePath),
    };
  });

/** Saves an image that was streamed straight to the browser. */
export const saveImageResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { dataUrl: string; prompt: string; model: string; aspect?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bytes, contentType } = storage.dataUrlToBytes(data.dataUrl);
    const path = await storage.uploadBytes(
      storage.GENERATIONS_BUCKET,
      context.userId,
      bytes,
      contentType,
    );
    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: context.userId,
        kind: "image",
        model: data.model,
        prompt: data.prompt,
        status: "completed",
        storage_path: path,
        params: { aspect: data.aspect ?? "1:1" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Starts a Hyper Video Omni job (text-to-video or image-to-video). */
export const startVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      imageUrl?: string;
      endImageUrl?: string;
      negative?: string;
      aspect?: string;
      seed?: number;
      frames?: number;
      frameRate?: number;
      resolution?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const { videoSize } = await import("@/lib/media.shared");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const aspect = data.aspect ?? "16:9";
    const resolution = data.resolution ?? "720p";
    const { width, height } = videoSize(aspect, resolution);

    const requestId = await providers.pixazoStartVideo({
      prompt: data.prompt,
      imageUrl: data.imageUrl,
      endImageUrl: data.endImageUrl,
      negative: data.negative,
      aspect,
      seed: data.seed,
      frames: data.frames,
      frameRate: data.frameRate,
      width,
      height,
    });

    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: context.userId,
        kind: "video",
        model: "hyper-video-omni",
        prompt: data.prompt,
        status: "running",
        params: {
          requestId,
          aspect,
          resolution,
          frames: data.frames ?? null,
          frameRate: data.frameRate ?? null,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, requestId };
  });


/** Polls a running video job; stores the file once the provider finishes. */
export const pollVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; requestId: string }) => input)
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const job = await providers.pixazoVideoStatus(data.requestId);

    if (job.status === "COMPLETED" && job.url) {
      const path = await storage.uploadFromUrl(
        storage.GENERATIONS_BUCKET,
        context.userId,
        job.url,
      );
      await supabaseAdmin
        .from("generations")
        .update({ status: "completed", storage_path: path })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      return {
        status: "completed" as const,
        url: await storage.signedUrl(storage.GENERATIONS_BUCKET, path),
      };
    }

    if (job.status === "ERROR" || job.status === "FAILED") {
      const message = job.error ?? "Video generation failed";
      await supabaseAdmin
        .from("generations")
        .update({ status: "failed", error: message })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      return { status: "failed" as const, error: message };
    }

    return { status: "running" as const };
  });

/** Hyper Audio Omni — text to speech, with voice / model / tone controls. */
export const generateSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { text: string; voice?: string; model?: string; tone?: string; pace?: number }) => input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { styledSpeechText } = await import("@/lib/media.shared");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { bytes, contentType } = await providers.lovableSpeech({
      text: styledSpeechText(data.text, data.tone, data.pace),
      voice: data.voice,
      model: data.model,
    });
    const path = await storage.uploadBytes(
      storage.GENERATIONS_BUCKET,
      context.userId,
      bytes,
      contentType,
    );
    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: context.userId,
        kind: "audio",
        model: "hyper-audio-omni",
        prompt: data.text,
        status: "completed",
        storage_path: path,
        params: {
          mode: "speech",
          voice: data.voice ?? "Kore",
          ttsModel: data.model ?? null,
          tone: data.tone ?? null,
          pace: data.pace ?? null,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, url: await storage.signedUrl(storage.GENERATIONS_BUCKET, path) };
  });

/**
 * Hyper Audio Omni — text to music. Routed to the AI gateway music endpoint;
 * the call surfaces a clear message while no music model is enabled for the
 * workspace, so the UI never fails silently.
 */
export const generateMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      genre?: string;
      mood?: string;
      tempo?: number;
      seconds?: number;
      instrumental?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const providers = await import("@/lib/providers.server");
    const storage = await import("@/lib/storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const brief = [
      data.prompt,
      data.genre ? `${data.genre} genre` : "",
      data.mood ? `${data.mood} mood` : "",
      data.tempo ? `${data.tempo} BPM` : "",
      data.instrumental ? "instrumental only" : "",
    ]
      .filter(Boolean)
      .join(", ");

    try {
      const { bytes, contentType } = await providers.lovableMusic({
        prompt: brief,
        seconds: data.seconds,
      });
      const path = await storage.uploadBytes(
        storage.GENERATIONS_BUCKET,
        context.userId,
        bytes,
        contentType,
      );
      const { data: row, error } = await supabaseAdmin
        .from("generations")
        .insert({
          user_id: context.userId,
          kind: "audio",
          model: "hyper-audio-omni",
          prompt: brief,
          status: "completed",
          storage_path: path,
          params: {
            mode: "music",
            genre: data.genre ?? null,
            mood: data.mood ?? null,
            tempo: data.tempo ?? null,
            seconds: data.seconds ?? null,
          },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id, url: await storage.signedUrl(storage.GENERATIONS_BUCKET, path) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Music generation failed";
      await supabaseAdmin.from("generations").insert({
        user_id: context.userId,
        kind: "audio",
        model: "hyper-audio-omni",
        prompt: brief,
        status: "failed",
        error: message,
        params: { mode: "music" },
      });
      throw new Error(message);
    }
  });


/** The signed-in user's generations, newest first, with fresh signed URLs. */
export const listGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind?: GenerationKind; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<GenerationRecord[]> => {
    const storage = await import("@/lib/storage.server");
    let query = context.supabase
      .from("generations")
      .select("id, kind, model, prompt, status, error, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.kind) query = query.eq("kind", data.kind);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((r) => r.storage_path).filter((p): p is string => !!p);
    const urls = await storage.signedUrls(storage.GENERATIONS_BUCKET, paths);

    return (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind as GenerationKind,
      model: r.model,
      prompt: r.prompt,
      status: r.status,
      error: r.error,
      createdAt: r.created_at,
      url: r.storage_path ? (urls[r.storage_path] ?? null) : null,
    }));
  });

export const deleteGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const storage = await import("@/lib/storage.server");
    const { data: row } = await context.supabase
      .from("generations")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("generations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.storage_path) {
      await storage.removeFiles(storage.GENERATIONS_BUCKET, [row.storage_path]);
    }
    return { ok: true };
  });

/**
 * Server-only generation providers.
 *
 * Pixazo  — Stable Diffusion Inpainting (text-to-image + image-to-image),
 *           Flux 1 Schnell (text-to-image), LTX video (text/image-to-video).
 * Lovable — Gemini image models and Gemini TTS through the AI Gateway.
 */

const PIXAZO_BASE = "https://gateway.pixazo.ai";
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

function pixazoKey() {
  const key = process.env["PIXAZO_API_KEY"];
  if (!key) throw new Error("Missing PIXAZO_API_KEY");
  return key;
}

function lovableKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

async function pixazoPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PIXAZO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Ocp-Apim-Subscription-Key": pixazoKey(),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Generation failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/** Aspect ratio label -> pixel size, rounded to multiples of 32. */
export function sizeForAspect(aspect: string, base = 1024): { width: number; height: number } {
  const [wRaw, hRaw] = aspect.split(":").map((n) => Number(n));
  const w = Number.isFinite(wRaw) && wRaw ? wRaw : 1;
  const h = Number.isFinite(hRaw) && hRaw ? hRaw : 1;
  const scale = base / Math.sqrt(w * h);
  const round = (v: number) => Math.max(256, Math.min(1536, Math.round((v * scale) / 32) * 32));
  return { width: round(w), height: round(h) };
}

/** Quality guard rails applied to every Pixazo image request. */
const DEFAULT_NEGATIVE =
  "lowres, worst quality, low quality, jpeg artifacts, blurry, out of focus, deformed, disfigured, mutated, extra limbs, extra fingers, bad anatomy, bad proportions, watermark, text, logo, signature, cropped, duplicate, glitch, noise, grain, oversaturated, creepy, horror";

/**
 * Stable Diffusion Inpainting — image-to-image only.
 *
 * The provider endpoint composites onto a fixed built-in base photo when no
 * `imageUrl` is supplied, which produced nonsense output. Callers must pass a
 * source image; use `pixazoImage` for prompt-only requests.
 */
export async function pixazoStableDiffusion(input: {
  prompt: string;
  imageUrl: string;
  maskUrl?: string | undefined;
  negativePrompt?: string | undefined;
  width: number;
  height: number;
  seed?: number | undefined;
  steps?: number | undefined;
  guidance?: number | undefined;
  /** Denoise amount: lower keeps the reference identity, higher allows change. */
  strength?: number | undefined;
}): Promise<string> {
  const base = {
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    ...(input.maskUrl ? { maskUrl: input.maskUrl } : {}),
    negative_prompt: [input.negativePrompt, DEFAULT_NEGATIVE].filter(Boolean).join(", "),
    width: input.width,
    height: input.height,
    num_steps: input.steps ?? 30,
    guidance: input.guidance ?? 7.5,
    ...(input.seed === undefined ? {} : { seed: input.seed }),
  };
  const withStrength =
    input.strength === undefined ? base : { ...base, strength: input.strength };

  let data: { imageUrl?: string; output?: string };
  try {
    data = await pixazoPost("/inpainting/v1/getImage", withStrength);
  } catch (err) {
    // Some deployments reject unknown sampler fields; retry with the safe body.
    if (input.strength === undefined) throw err;
    data = await pixazoPost("/inpainting/v1/getImage", base);
  }
  const url = data.imageUrl ?? data.output;
  if (!url) throw new Error("Image provider returned no image");
  return url;
}

/** Runs a provider call again once on a transient failure. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Generation failed");
}


/** Hyper Image Speed — Flux 1 Schnell (text-to-image only). */
export async function pixazoFluxSchnell(input: {
  prompt: string;
  width: number;
  height: number;
  seed?: number | undefined;
  steps?: number | undefined;
}): Promise<string> {
  const data = await pixazoPost<{ output?: string; imageUrl?: string }>(
    "/flux-1-schnell/v1/getData",
    {
      prompt: input.prompt,
      num_steps: Math.min(8, Math.max(4, input.steps ?? 8)),
      width: input.width,
      height: input.height,
      ...(input.seed === undefined ? {} : { seed: input.seed }),
    },
  );
  const url = data.output ?? data.imageUrl;
  if (!url) throw new Error("Image provider returned no image");
  return url;
}

/**
 * Hyper Image Flash — routes to the right Pixazo model for the request:
 * a reference image goes to Stable Diffusion Inpainting (image-to-image),
 * a prompt-only request goes to a real text-to-image model.
 */
export async function pixazoImage(input: {
  prompt: string;
  imageUrl?: string | undefined;
  maskUrl?: string | undefined;
  negativePrompt?: string | undefined;
  width: number;
  height: number;
  seed?: number | undefined;
  steps?: number | undefined;
  guidance?: number | undefined;
  strength?: number | undefined;
}): Promise<string> {
  if (input.imageUrl) {
    const imageUrl = input.imageUrl;
    return withRetry(() => pixazoStableDiffusion({ ...input, imageUrl }));
  }
  return withRetry(() =>
    pixazoFluxSchnell({
      prompt: input.prompt,
      width: input.width,
      height: input.height,
      seed: input.seed,
    }),
  );
}



/** Hyper Video Omni — LTX free tier. Returns an async job id. */
export async function pixazoStartVideo(input: {
  prompt: string;
  imageUrl?: string | undefined;
  negative?: string | undefined;
  aspect?: string | undefined;
  seed?: number | undefined;
  frames?: number | undefined;
  frameRate?: number | undefined;
}): Promise<string> {
  const path = input.imageUrl ? "/ltx-video/v1/image-to-video" : "/ltx-video/v1/text-to-video";
  const data = await pixazoPost<{ request_id?: string }>(path, {
    prompt: input.prompt,
    ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    ...(input.negative ? { negative: input.negative } : {}),
    ...(input.aspect ? { aspect: input.aspect } : {}),
    ...(input.seed === undefined ? {} : { seed: input.seed }),
    ...(input.frames ? { num_frames: input.frames } : {}),
    ...(input.frameRate ? { frame_rate: input.frameRate } : {}),
  });
  if (!data.request_id) throw new Error("Video provider returned no job id");
  return data.request_id;
}

export type VideoJob = { status: string; url?: string | undefined; error?: string | undefined };

export async function pixazoVideoStatus(requestId: string): Promise<VideoJob> {
  const res = await fetch(`${PIXAZO_BASE}/v2/requests/status/${requestId}`, {
    headers: { "Ocp-Apim-Subscription-Key": pixazoKey() },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Video status failed (${res.status}): ${text.slice(0, 200)}`);
  const data = JSON.parse(text) as {
    status?: string;
    error?: string;
    output?: { media_url?: string[] };
  };
  const status = (data.status ?? "PROCESSING").toUpperCase();
  return {
    status,
    url: data.output?.media_url?.[0],
    error: data.error,
  };
}

/** Hyper Image Quality — Gemini image model on the Lovable AI Gateway. */
export async function lovableGeminiImage(input: {
  prompt: string;
  model?: string | undefined;
  imageUrls?: string[] | undefined;
}): Promise<string> {
  const content: unknown[] = [{ type: "text", text: input.prompt }];
  for (const url of input.imageUrls ?? []) {
    content.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch(`${LOVABLE_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "google/gemini-3.1-flash-image",
      messages: [
        { role: "user", content: (input.imageUrls ?? []).length ? content : input.prompt },
      ],
      modalities: ["image", "text"],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Image generation failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no image");
  return `data:image/png;base64,${b64}`;
}

/** Hyper Audio Omni (speech) — Gemini TTS on the Lovable AI Gateway. Returns WAV bytes. */
export async function lovableSpeech(input: {
  text: string;
  voice?: string | undefined;
  model?: string | undefined;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(`${LOVABLE_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "google/gemini-2.5-flash-tts",
      contents: [{ role: "user", parts: [{ text: input.text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice ?? "Kore" } },
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Speech generation failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, contentType: res.headers.get("content-type") ?? "audio/wav" };
}

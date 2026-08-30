/** Server-only helpers that persist generated media in Supabase Storage. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const GENERATIONS_BUCKET = "generations";
export const MODELS_BUCKET = "virtual-models";

const SIGNED_URL_TTL = 60 * 60 * 24; // 24h

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Unsupported data URL");
  const contentType = match[1] ?? "application/octet-stream";
  const binary = atob(match[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

function extFor(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg")) return "mp3";
  return "bin";
}

export async function uploadBytes(
  bucket: string,
  userId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${extFor(contentType)}`;
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Could not save the file: ${error.message}`);
  return path;
}

/** Downloads a provider result URL and stores it in the given bucket. */
export async function uploadFromUrl(
  bucket: string,
  userId: string,
  url: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the generated file (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return uploadBytes(bucket, userId, bytes, contentType);
}

export async function signedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function signedUrls(
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      const url = await signedUrl(bucket, p);
      if (url) out[p] = url;
    }),
  );
  return out;
}

export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabaseAdmin.storage.from(bucket).remove(paths);
}

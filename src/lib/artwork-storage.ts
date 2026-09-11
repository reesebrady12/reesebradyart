import { supabase } from "./supabase";

export const ARTWORK_BUCKET = "artwork";

export function getArtworkPublicUrl(path?: string | null) {
  const value = path?.trim();
  if (!value) return "";

  // Keep legacy and externally hosted records readable while stored paths are
  // migrated. New records should contain only a bucket-relative path.
  if (value.startsWith("/") || /^https?:\/\//i.test(value)) return value;
  if (!supabase) return "";

  return supabase.storage.from(ARTWORK_BUCKET).getPublicUrl(value).data
    .publicUrl;
}

import { adminApi } from "./admin-api";
import { ARTWORK_BUCKET } from "./artwork-storage";
import { supabase } from "./supabase";

export const artworkImageTypes = [
  ["front", "Main / Front"],
  ["angle", "Angle"],
  ["detail", "Detail"],
  ["texture", "Texture"],
  ["side", "Side"],
  ["back", "Back"],
  ["frame", "Framed"],
  ["room", "Room"],
  ["other", "Other"],
] as const;

export type PendingPaintingImage = {
  localId: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  altText: string;
  imageType: string;
  isPrimary: boolean;
  status: "ready" | "processing" | "uploading" | "complete" | "error";
  progress: number;
  error?: string;
  databaseId?: string;
};

export async function inspectPaintingFile(file: File) {
  if (["image/heic", "image/heif"].includes(file.type.toLowerCase()))
    throw new Error(
      `${file.name}: HEIC/HEIF is not supported yet. Export it as JPEG, PNG, or WebP first.`,
    );
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(`${file.name}: choose a JPEG, PNG, or WebP image.`);
  if (file.size > 40 * 1024 * 1024)
    throw new Error(`${file.name}: the maximum master-image size is 40 MB.`);
  const previewUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () =>
          reject(new Error(`${file.name}: image could not be decoded.`));
        image.src = previewUrl;
      },
    );
    return { previewUrl, ...dimensions };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

async function makeWebVersion(bitmap: ImageBitmap, maximumWidth: number) {
  const scale = Math.min(1, maximumWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot prepare web images.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.93),
  );
  if (!blob) throw new Error("A responsive image could not be generated.");
  return blob;
}

type SignedUpload = { path: string; token: string; assetId: string };

export async function uploadPaintingImage(
  paintingId: string,
  image: PendingPaintingImage,
  sortOrder: number,
  report: (status: PendingPaintingImage["status"], progress: number) => void,
) {
  if (!supabase)
    throw new Error("Supabase browser credentials are not configured.");
  report("processing", 5);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image.file, {
      imageOrientation: "from-image",
    });
  } catch {
    report("error", 0);
    throw new Error(
      `${image.file.name}: this browser could not prepare the image. Try exporting it as a standard JPEG and upload it again.`,
    );
  }
  let thumbnail: Blob;
  let gallery: Blob;
  let large: Blob;
  try {
    // Decode the master once and render each size in sequence. Large camera
    // images otherwise require several full-resolution bitmaps at the same time.
    thumbnail = await makeWebVersion(bitmap, 400);
    gallery = await makeWebVersion(bitmap, 1200);
    large = await makeWebVersion(bitmap, 2400);
  } finally {
    bitmap.close();
  }
  const assetId = crypto.randomUUID();
  const versions = [
    { version: "original", file: image.file, mimeType: image.file.type },
    { version: "thumbnail", file: thumbnail, mimeType: "image/webp" },
    { version: "gallery", file: gallery, mimeType: "image/webp" },
    { version: "large", file: large, mimeType: "image/webp" },
  ];
  const uploadedPaths: string[] = [];
  try {
    const signedUploads: SignedUpload[] = [];
    for (const entry of versions) {
      signedUploads.push(
        await adminApi<SignedUpload>("/api/admin/images?action=sign", {
          method: "POST",
          body: JSON.stringify({
            paintingId,
            filename: image.file.name,
            mimeType: entry.mimeType,
            fileSize: entry.file.size,
            assetId,
            version: entry.version,
          }),
        }),
      );
    }
    for (let index = 0; index < versions.length; index++) {
      report("uploading", 20 + index * 17);
      const upload = await supabase.storage
        .from(ARTWORK_BUCKET)
        .uploadToSignedUrl(
          signedUploads[index].path,
          signedUploads[index].token,
          versions[index].file,
          { contentType: versions[index].mimeType },
        );
      if (upload.error) throw upload.error;
      uploadedPaths.push(signedUploads[index].path);
    }
    const result = await adminApi<{ image: { id: string } }>(
      "/api/admin/images?action=complete",
      {
        method: "POST",
        body: JSON.stringify({
          painting_id: paintingId,
          storage_path: signedUploads[0].path,
          thumbnail_path: signedUploads[1].path,
          gallery_path: signedUploads[2].path,
          large_path: signedUploads[3].path,
          original_filename: image.file.name,
          alt_text: image.altText,
          image_type: image.imageType,
          sort_order: sortOrder,
          width: image.width,
          height: image.height,
          file_size: image.file.size,
          mime_type: image.file.type,
        }),
      },
    );
    report("complete", 100);
    return result.image.id;
  } catch (error) {
    await Promise.all(
      uploadedPaths.map((storagePath) =>
        adminApi("/api/admin/images?action=discard", {
          method: "POST",
          body: JSON.stringify({
            painting_id: paintingId,
            storage_path: storagePath,
          }),
        }).catch(() => undefined),
      ),
    );
    report("error", 0);
    throw error;
  }
}

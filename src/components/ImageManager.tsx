import { useRef, useState, type DragEvent } from "react";
import { adminApi } from "../lib/admin-api";
import {
  artworkImageTypes,
  inspectPaintingFile,
  uploadPaintingImage,
  type PendingPaintingImage,
} from "../lib/image-upload";
type ImageRow = {
  id: string;
  storage_path: string;
  alt_text: string;
  image_type: string;
  sort_order: number;
  is_primary: boolean;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  public_url?: string;
};
export function ImageManager({
  paintingId,
  images,
  onChange,
}: {
  paintingId: string;
  images: ImageRow[];
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<number | null>(null);
  const upload = async (files: File[]) => {
    setBusy(true);
    setError("");
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        const inspected = await inspectPaintingFile(file);
        const pending: PendingPaintingImage = {
          localId: crypto.randomUUID(),
          file,
          previewUrl: inspected.previewUrl,
          width: inspected.width,
          height: inspected.height,
          altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          imageType: images.length + index === 0 ? "front" : "other",
          isPrimary: images.length + index === 0,
          status: "ready",
          progress: 0,
        };
        try {
          await uploadPaintingImage(
            paintingId,
            pending,
            images.length + index,
            (status, percent) =>
              setProgress(
                `${status === "processing" ? "Preparing" : "Uploading"} ${index + 1} of ${files.length}: ${file.name} (${percent}%)`,
              ),
          );
        } finally {
          URL.revokeObjectURL(inspected.previewUrl);
        }
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    void upload([...event.dataTransfer.files]);
  };
  const update = async (image: ImageRow, changes: Partial<ImageRow>) => {
    await adminApi(`/api/admin/images?id=${image.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...image, painting_id: paintingId, ...changes }),
    });
    onChange();
  };
  const reorder = async (from: number, to: number) => {
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBusy(true);
    setError("");
    try {
      await adminApi("/api/admin/images?action=reorder", {
        method: "PATCH",
        body: JSON.stringify({
          painting_id: paintingId,
          image_ids: next.map((image) => image.id),
        }),
      });
      onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reorder failed.");
    } finally {
      setBusy(false);
      setDragged(null);
    }
  };
  return (
    <section className="image-manager">
      <div
        className={`drop-zone ${busy ? "busy" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={drop}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload painting images"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
      >
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => void upload([...(e.target.files ?? [])])}
        />
        <strong aria-live="polite">
          {busy ? progress : "Drop artwork images here"}
        </strong>
        <span>or choose files · JPEG, PNG, WebP · up to 40 MB each</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="image-admin-grid">
        {[...images]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((image, index) => {
            const url = image.public_url ?? "";
            return (
              <article
                key={image.id}
                draggable
                onDragStart={() => setDragged(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragged !== null && void reorder(dragged, index)}
              >
                <img src={url} alt={image.alt_text} />
                <p>
                  {image.width} × {image.height} ·{" "}
                  {(image.file_size / 1024 / 1024).toFixed(1)} MB
                </p>
                <label>
                  Alt text
                  <input
                    value={image.alt_text}
                    onChange={(e) =>
                      void update(image, { alt_text: e.target.value })
                    }
                  />
                </label>
                <label>
                  Image type
                  <select
                    value={image.image_type}
                    onChange={(e) =>
                      void update(image, { image_type: e.target.value })
                    }
                  >
                    {artworkImageTypes.map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="image-actions">
                  <button
                    type="button"
                    disabled={image.is_primary}
                    onClick={() => void update(image, { is_primary: true })}
                  >
                    {image.is_primary ? "Cover image" : "Make cover"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm("Remove this image?")) {
                        await adminApi(`/api/admin/images?id=${image.id}`, {
                          method: "DELETE",
                        });
                        onChange();
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}

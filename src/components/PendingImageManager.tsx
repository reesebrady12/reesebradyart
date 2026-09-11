import {
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import {
  artworkImageTypes,
  inspectPaintingFile,
  type PendingPaintingImage,
} from "../lib/image-upload";

export function PendingImageManager({
  images,
  setImages,
  title,
  disabled,
  hasStoredImages,
  onMakePrimary,
}: {
  images: PendingPaintingImage[];
  setImages: Dispatch<SetStateAction<PendingPaintingImage[]>>;
  title: string;
  disabled: boolean;
  hasStoredImages: boolean;
  onMakePrimary: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [error, setError] = useState("");

  const addFiles = async (files: File[]) => {
    setError("");
    const additions: PendingPaintingImage[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const inspected = await inspectPaintingFile(file);
        additions.push({
          localId: crypto.randomUUID(),
          file,
          ...inspected,
          altText: title ? `${title} artwork view` : "",
          imageType:
            additions.length === 0 && images.length === 0 && !hasStoredImages
              ? "front"
              : "other",
          isPrimary:
            additions.length === 0 && images.length === 0 && !hasStoredImages,
          status: "ready",
          progress: 0,
        });
      } catch (reason) {
        errors.push(
          reason instanceof Error
            ? reason.message
            : `${file.name}: invalid image.`,
        );
      }
    }
    if (additions.length) setImages((current) => [...current, ...additions]);
    if (errors.length) setError(errors.join(" "));
    if (input.current) input.current.value = "";
  };
  const reorder = (from: number, to: number) => {
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragged(null);
  };
  const update = (localId: string, values: Partial<PendingPaintingImage>) =>
    setImages((current) =>
      current.map((image) =>
        image.localId === localId ? { ...image, ...values } : image,
      ),
    );
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (!disabled) void addFiles([...event.dataTransfer.files]);
  };

  return (
    <section className="pending-images">
      {hasStoredImages && <h3>New images</h3>}
      <div
        className={`drop-zone ${disabled ? "busy" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload painting photos"
        onClick={() => !disabled && input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            input.current?.click();
          }
        }}
      >
        <input
          ref={input}
          hidden
          multiple
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(event) => void addFiles([...(event.target.files ?? [])])}
        />
        <strong>Drop painting photos here or click to browse</strong>
        <span>JPEG, PNG, or WebP · high-quality masters up to 40 MB each</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="pending-image-list">
        {images.map((image, index) => (
          <article
            key={image.localId}
            draggable={!disabled}
            onDragStart={() => setDragged(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dragged !== null && reorder(dragged, index)}
          >
            <img src={image.previewUrl} alt="" />
            <div className="pending-image-fields">
              <div className="pending-image-heading">
                <div>
                  <strong>{image.file.name}</strong>
                  <span>
                    {(image.file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {image.width} × {image.height}
                  </span>
                </div>
                <span className={`upload-status upload-${image.status}`}>
                  {image.status === "uploading" || image.status === "processing"
                    ? `${image.status} ${image.progress}%`
                    : image.status}
                </span>
              </div>
              <label>
                Alt text
                <input
                  value={image.altText}
                  disabled={disabled}
                  onChange={(event) =>
                    update(image.localId, { altText: event.target.value })
                  }
                  placeholder="Describe this view for screen-reader users"
                />
              </label>
              <label>
                Image type
                <select
                  value={image.imageType}
                  disabled={disabled}
                  onChange={(event) =>
                    update(image.localId, { imageType: event.target.value })
                  }
                >
                  {artworkImageTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="image-actions">
                <button
                  type="button"
                  disabled={disabled || image.isPrimary}
                  onClick={() => {
                    onMakePrimary();
                    setImages((current) =>
                      current.map((entry) => ({
                        ...entry,
                        isPrimary: entry.localId === image.localId,
                      })),
                    );
                  }}
                >
                  {image.isPrimary ? "Primary image" : "Make primary"}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    URL.revokeObjectURL(image.previewUrl);
                    setImages((current) => {
                      const remaining = current.filter(
                        (entry) => entry.localId !== image.localId,
                      );
                      if (image.isPrimary && remaining[0])
                        remaining[0] = { ...remaining[0], isPrimary: true };
                      return remaining;
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

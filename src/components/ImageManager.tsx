import { useState, type DragEvent } from "react";
import { artworkImageTypes } from "../lib/image-upload";

export type StoredPaintingImage = {
  id: string;
  storage_path: string;
  public_url?: string;
  alt_text: string;
  image_type: string;
  sort_order: number;
  is_primary: boolean;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
};

export function ImageManager({
  images,
  disabled,
  onChange,
  onRemove,
  onMakePrimary,
}: {
  images: StoredPaintingImage[];
  disabled: boolean;
  onChange: (images: StoredPaintingImage[]) => void;
  onRemove: (image: StoredPaintingImage) => void;
  onMakePrimary: () => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);

  const update = (id: string, changes: Partial<StoredPaintingImage>) =>
    onChange(
      ordered.map((image) =>
        image.id === id ? { ...image, ...changes } : image,
      ),
    );

  const reorder = (from: number, to: number) => {
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((image, index) => ({ ...image, sort_order: index })));
    setDragged(null);
  };

  const makePrimary = (id: string) => {
    onMakePrimary();
    onChange(
      ordered.map((image) => ({ ...image, is_primary: image.id === id })),
    );
  };

  const drop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (!disabled && dragged !== null) reorder(dragged, index);
  };

  if (!ordered.length) return null;

  return (
    <section className="image-manager" aria-labelledby="stored-images-heading">
      <h3 id="stored-images-heading">Saved images</h3>
      <p className="panel-help">
        Changes to these images are applied when you save the artwork.
      </p>
      <div className="image-admin-grid">
        {ordered.map((image, index) => (
          <article
            key={image.id}
            draggable={!disabled}
            onDragStart={() => setDragged(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, index)}
          >
            <img src={image.public_url ?? ""} alt={image.alt_text} />
            <p>
              {image.is_primary && <strong>Cover image · </strong>}
              {image.width} × {image.height} ·{" "}
              {(image.file_size / 1024 / 1024).toFixed(1)} MB
            </p>
            <label>
              Alt text
              <input
                value={image.alt_text}
                disabled={disabled}
                onChange={(event) =>
                  update(image.id, { alt_text: event.target.value })
                }
              />
            </label>
            <label>
              Image type
              <select
                value={image.image_type}
                disabled={disabled}
                onChange={(event) =>
                  update(image.id, { image_type: event.target.value })
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
                disabled={disabled || image.is_primary}
                onClick={() => makePrimary(image.id)}
              >
                {image.is_primary ? "Cover image" : "Make cover"}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(image)}
              >
                Remove on save
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

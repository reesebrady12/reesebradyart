import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import { Link, useLocation, useParams } from "wouter";
import { ImageManager } from "../../components/ImageManager";
import { PendingImageManager } from "../../components/PendingImageManager";
import {
  VariantsEditor,
  type EditableVariant,
} from "../../components/VariantsEditor";
import { adminApi } from "../../lib/admin-api";
import {
  uploadPaintingImage,
  type PendingPaintingImage,
} from "../../lib/image-upload";
import { artworkCategories, artworkMediums } from "../../lib/artwork";

type StoredImage = {
  id: string;
  public_url?: string;
  alt_text: string;
  image_type: string;
  sort_order: number;
  is_primary: boolean;
  storage_path: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
};
type Painting = Record<string, unknown> & {
  id: string;
  title: string;
  price_in_cents: number;
  painting_images: StoredImage[];
  product_variants: EditableVariant[];
};

const blank = {
  title: "",
  slug: "",
  description: "",
  category: "available",
  purchasable: true,
  type: "original",
  price_dollars: "",
  width: "",
  height: "",
  dimension_unit: "in",
  medium: "",
  completion_date: "",
  completion_year: new Date().getFullYear(),
  commissioned: false,
  collection_label: "",
  inventory: 1,
  status: "draft",
  featured: false,
  stripe_product_id: "",
  stripe_price_id: "",
  painting_images: [] as StoredImage[],
  product_variants: [] as EditableVariant[],
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function PaintingFormPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<Record<string, unknown>>(blank);
  const [pendingImages, setPendingImages] = useState<PendingPaintingImage[]>(
    [],
  );
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const submissionId = useRef(crypto.randomUUID());
  const [createdId, setCreatedId] = useState<string | null>(null);
  const dirty = useRef(false);
  const slugWasEdited = useRef(false);
  const paintingId = id ?? createdId;
  const editing = Boolean(paintingId);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await adminApi<{ painting: Painting }>(
        `/api/admin/paintings?id=${id}`,
      );
      setForm({
        ...data.painting,
        price_dollars: (data.painting.price_in_cents / 100).toFixed(2),
      });
      dirty.current = false;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Painting could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    void adminApi<{ painting: Painting }>(`/api/admin/paintings?id=${id}`)
      .then((data) => {
        if (!active) return;
        setForm({
          ...data.painting,
          price_dollars: (data.painting.price_in_cents / 100).toFixed(2),
        });
        dirty.current = false;
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Painting could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current || saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  const set = (key: string, value: unknown) => {
    dirty.current = true;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePending = (
    updater:
      | PendingPaintingImage[]
      | ((current: PendingPaintingImage[]) => PendingPaintingImage[]),
  ) => {
    dirty.current = true;
    setPendingImages(updater);
  };

  const validateForPublish = () => {
    const next: Record<string, string> = {};
    if (!String(form.title ?? "").trim()) next.title = "Title is required.";
    if (!String(form.description ?? "").trim())
      next.description = "Description is required before publishing.";
    if (
      form.category === "available" &&
      !/^\d+(?:\.\d{1,2})?$/.test(String(form.price_dollars ?? ""))
    )
      next.price_dollars = "Enter a valid dollar amount.";
    if (form.category === "available" && !(Number(form.width) > 0))
      next.width = "Width is required.";
    if (form.category === "available" && !(Number(form.height) > 0))
      next.height = "Height is required.";
    if (!form.completion_date && !form.completion_year)
      next.completion_year = "Enter a completion date or year.";
    const stored = (form.painting_images ?? []) as StoredImage[];
    if (!stored.length && !pendingImages.length)
      next.images = "Add at least one painting image.";
    if (pendingImages.some((image) => !image.altText.trim()))
      next.images = "Add alt text to every image before publishing.";
    setFields(next);
    if (Object.keys(next).length) {
      setError("Complete the highlighted fields before publishing.");
      return false;
    }
    return true;
  };

  const save = async (status: "draft" | "published", event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (status === "published" && !validateForPublish()) return;
    setSaving(true);
    setError("");
    setSaved("");
    if (status === "draft") setFields({});
    let draftExists = Boolean(paintingId);
    try {
      let targetId = paintingId;
      const payload = {
        ...form,
        status: targetId ? status : "draft",
        inventory: status === "published" ? form.inventory : form.inventory,
        submission_id: submissionId.current,
      };
      if (!targetId) {
        const result = await adminApi<{ painting: Painting }>(
          "/api/admin/paintings",
          { method: "POST", body: JSON.stringify(payload) },
        );
        targetId = result.painting.id;
        setCreatedId(targetId);
        draftExists = true;
        setSaved("Draft record created. Uploading artwork images…");
      } else if (status === "draft") {
        await adminApi(`/api/admin/paintings?id=${targetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      const uploadedIds: string[] = [];
      for (let index = 0; index < pendingImages.length; index++) {
        const pending = pendingImages[index];
        if (pending.databaseId) {
          uploadedIds.push(pending.databaseId);
          continue;
        }
        const databaseId = await uploadPaintingImage(
          targetId,
          pending,
          index,
          (imageStatus, progress) =>
            setPendingImages((current) =>
              current.map((image) =>
                image.localId === pending.localId
                  ? { ...image, status: imageStatus, progress }
                  : image,
              ),
            ),
        );
        uploadedIds.push(databaseId);
        setPendingImages((current) =>
          current.map((image) =>
            image.localId === pending.localId
              ? { ...image, databaseId, status: "complete", progress: 100 }
              : image,
          ),
        );
      }

      if (uploadedIds.length) {
        await adminApi("/api/admin/images?action=reorder", {
          method: "PATCH",
          body: JSON.stringify({
            painting_id: targetId,
            image_ids: uploadedIds,
          }),
        });
        const primaryIndex = Math.max(
          0,
          pendingImages.findIndex((image) => image.isPrimary),
        );
        const primary = pendingImages[primaryIndex];
        if (primary && uploadedIds[primaryIndex])
          await adminApi(`/api/admin/images?id=${uploadedIds[primaryIndex]}`, {
            method: "PATCH",
            body: JSON.stringify({
              painting_id: targetId,
              alt_text: primary.altText,
              image_type: primary.imageType,
              sort_order: primaryIndex,
              is_primary: true,
            }),
          });
      }

      if (status === "published") {
        await adminApi(`/api/admin/paintings?id=${targetId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, status: "published" }),
        });
      }
      dirty.current = false;
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      navigate(`/admin/paintings/${targetId}/edit`);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Painting could not be saved.";
      setError(
        draftExists
          ? `${message} Your painting record remains safely saved as a draft; retry to finish the uploads.`
          : message,
      );
      if (typeof reason === "object" && reason && "fields" in reason)
        setFields(reason.fields as Record<string, string>);
    } finally {
      setSaving(false);
    }
  };

  const leave = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      dirty.current &&
      !confirm("Leave without saving your painting changes?")
    )
      event.preventDefault();
  };

  if (loading) return <div className="admin-state">Loading painting…</div>;
  const storedImages = (form.painting_images ?? []) as StoredImage[];
  const previewImage =
    pendingImages.find((image) => image.isPrimary)?.previewUrl ??
    storedImages.find((image) => image.is_primary)?.public_url ??
    storedImages[0]?.public_url;
  const pricePreview = /^\d+(?:\.\d{1,2})?$/.test(
    String(form.price_dollars ?? ""),
  )
    ? `$${Number(form.price_dollars).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "$0.00";

  const field = (
    name: string,
    label: string,
    options: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label>
      {label}
      <input
        {...options}
        value={String(form[name] ?? "")}
        onChange={(event) => {
          if (name === "slug") slugWasEdited.current = true;
          const value =
            options.type === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value;
          set(name, value);
          if (name === "title" && !slugWasEdited.current)
            set("slug", slugify(event.target.value));
        }}
      />
      {fields[name] && <span className="field-error">{fields[name]}</span>}
    </label>
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">{editing ? "Edit artwork" : "New artwork"}</p>
          <h1>
            {editing ? String(form.title || "Untitled") : "Add new painting"}
          </h1>
        </div>
        <Link
          className="secondary-button"
          href="/admin/paintings"
          onClick={leave}
        >
          Back to paintings
        </Link>
      </header>

      <form
        className="painting-form painting-create-layout"
        onSubmit={(event) => void save("draft", event)}
      >
        <div className="painting-form-main">
          <section className="form-panel">
            <h2>Painting information</h2>
            <div className="form-grid">
              {field("title", "Title *", { placeholder: "Evening Light" })}
              {field("slug", "Slug *", { placeholder: "evening-light" })}
              <label>
                Artwork category *
                <select
                  value={String(form.category ?? "available")}
                  onChange={(event) => {
                    const category = event.target.value;
                    dirty.current = true;
                    setForm((current) => ({
                      ...current,
                      category,
                      purchasable: category === "available",
                      sold: category === "sold",
                      inventory:
                        category === "sold"
                          ? 0
                          : category === "project"
                            ? null
                            : current.type === "original"
                              ? 1
                              : current.inventory,
                      status:
                        category === "sold" && current.status === "published"
                          ? "sold"
                          : category !== "sold" && current.status === "sold"
                            ? "draft"
                            : current.status,
                    }));
                  }}
                >
                  {artworkCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Description *
                <textarea
                  rows={8}
                  value={String(form.description ?? "")}
                  placeholder="Describe the painting, its atmosphere, and the story behind it…"
                  onChange={(event) => set("description", event.target.value)}
                />
                {fields.description && (
                  <span className="field-error">{fields.description}</span>
                )}
              </label>
              {field("width", "Width *", {
                type: "number",
                min: 0.01,
                step: "0.01",
                placeholder: "24",
              })}
              {field("height", "Height *", {
                type: "number",
                min: 0.01,
                step: "0.01",
                placeholder: "36",
              })}
              <label>
                Dimension unit
                <select
                  value={String(form.dimension_unit)}
                  onChange={(event) =>
                    set("dimension_unit", event.target.value)
                  }
                >
                  <option value="in">Inches</option>
                  <option value="cm">Centimeters</option>
                </select>
              </label>
              <label>
                Medium
                <select
                  value={String(form.medium ?? "")}
                  onChange={(event) => set("medium", event.target.value)}
                >
                  <option value="">Not specified</option>
                  {artworkMediums.map((medium) => (
                    <option key={medium.value} value={medium.value}>
                      {medium.label}
                    </option>
                  ))}
                </select>
                {fields.medium && (
                  <span className="field-error">{fields.medium}</span>
                )}
              </label>
              {field("completion_date", "Completion date", { type: "date" })}
              {field("completion_year", "Completion year *", {
                type: "number",
                min: 1000,
                max: 9999,
              })}
              <label>
                Product type
                <select
                  value={String(form.type)}
                  onChange={(event) => {
                    set("type", event.target.value);
                    if (event.target.value === "original") set("inventory", 1);
                  }}
                >
                  <option value="original">Original</option>
                  <option value="print">Print</option>
                </select>
              </label>
            </div>
          </section>

          <section className="form-panel">
            <h2>Artwork images *</h2>
            <p className="panel-help">
              Masters are preserved unchanged. High-quality 400px, 1200px, and
              2400px WebP versions are generated for fast browsing and detailed
              viewing.
            </p>
            {id && paintingId ? (
              <ImageManager
                paintingId={paintingId}
                images={storedImages}
                onChange={load}
              />
            ) : (
              <PendingImageManager
                images={pendingImages}
                setImages={updatePending}
                title={String(form.title ?? "")}
                disabled={saving}
              />
            )}
            {fields.images && <p className="field-error">{fields.images}</p>}
          </section>

          {form.category === "available" && form.type === "print" && (
            <VariantsEditor
              variants={(form.product_variants ?? []) as EditableVariant[]}
              onChange={(variants) => set("product_variants", variants)}
            />
          )}

          <section className="form-panel product-preview-panel">
            <h2>Live preview</h2>
            <div className="painting-preview">
              <div className="painting-preview-image">
                {previewImage ? (
                  <img src={previewImage} alt="" />
                ) : (
                  <span>Add a painting photo</span>
                )}
              </div>
              <div>
                <p className="eyebrow">
                  {form.type === "original"
                    ? "Original painting"
                    : "Fine-art print"}
                </p>
                <h3>{String(form.title || "Untitled painting")}</h3>
                {form.category === "available" && (
                  <strong>{pricePreview}</strong>
                )}
                <p>
                  {form.width && form.height
                    ? `${form.width} × ${form.height} ${form.dimension_unit === "cm" ? "cm" : "in"}`
                    : "Dimensions"}
                </p>
                <p>
                  {artworkMediums.find((medium) => medium.value === form.medium)
                    ?.label || "Medium"}
                </p>
                <p>
                  {String(
                    form.description || "Your description will appear here.",
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="painting-form-sidebar">
          <section className="form-panel">
            <h2>Publishing</h2>
            <label>
              Status
              <select
                value={String(form.status)}
                onChange={(event) => set("status", event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="sold">Sold</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(event) => set("featured", event.target.checked)}
              />{" "}
              Featured painting
            </label>
            {form.category === "sold" && (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(form.commissioned)}
                    onChange={(event) =>
                      set("commissioned", event.target.checked)
                    }
                  />{" "}
                  This was a commissioned piece
                </label>
                {field("collection_label", "Public status label", {
                  placeholder: "Private Collection",
                })}
              </>
            )}
          </section>
          {form.category === "available" && (
            <section className="form-panel">
              <h2>Price & inventory</h2>
              <label>
                Price (USD) *
                <div className="money-input">
                  <span>$</span>
                  <input
                    inputMode="decimal"
                    placeholder="450.00"
                    value={String(form.price_dollars ?? "")}
                    onChange={(event) =>
                      set("price_dollars", event.target.value)
                    }
                  />
                </div>
                {fields.price_dollars && (
                  <span className="field-error">{fields.price_dollars}</span>
                )}
              </label>
              {field("inventory", "Inventory", {
                type: "number",
                min: 0,
                max: form.type === "original" ? 1 : 9999,
              })}
            </section>
          )}
          {form.category === "available" && (
            <section className="form-panel">
              <h2>Stripe</h2>
              <p className="panel-help">
                Required before publishing a purchasable painting.
              </p>
              {field("stripe_product_id", "Stripe Product ID", {
                placeholder: "prod_…",
              })}
              {field("stripe_price_id", "Stripe Price ID", {
                placeholder: "price_…",
              })}
            </section>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="form-success" role="status">
              {saved}
            </p>
          )}
          <div className="painting-submit-actions">
            <button
              type="submit"
              className="secondary-button"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => void save("published")}
            >
              {saving ? "Working…" : "Publish painting"}
            </button>
          </div>
        </aside>
      </form>
    </>
  );
}

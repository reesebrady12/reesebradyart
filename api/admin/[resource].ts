import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin, safeError } from "../_lib/admin.js";
import { validateProduct } from "../_lib/product-validation.js";

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const imageTypes = [
  "front",
  "angle",
  "detail",
  "texture",
  "side",
  "back",
  "frame",
  "room",
  "other",
];
const cleanName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-100);
const hasImageSignature = (bytes: Uint8Array, mimeType: string) => {
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  if (mimeType === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  if (mimeType === "image/avif")
    return (
      new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp" &&
      ["avif", "avis"].includes(new TextDecoder().decode(bytes.slice(8, 12)))
    );
  return false;
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const { supabase } = await requireAdmin(request);
    const resource = String(request.query.resource);
    const id =
      typeof request.query.id === "string" ? request.query.id : undefined;

    if (resource === "session" && request.method === "GET")
      return response.json({ admin: true });
    if (resource === "dashboard" && request.method === "GET") {
      const [
        { data: products, error: productError },
        { data: orders, error: orderError },
      ] = await Promise.all([
        supabase.from("products").select("status,type,sold,inventory"),
        supabase
          .from("orders")
          .select(
            "id,customer_name,total,payment_status,fulfillment_status,created_at",
          )
          .order("created_at", { ascending: false }),
      ]);
      if (productError || orderError) throw productError ?? orderError;
      return response.json({
        metrics: {
          published: products.filter((p) => p.status === "published").length,
          drafts: products.filter((p) => p.status === "draft").length,
          availableOriginals: products.filter(
            (p) => p.type === "original" && !p.sold && p.inventory === 1,
          ).length,
          soldOriginals: products.filter((p) => p.type === "original" && p.sold)
            .length,
          awaitingFulfillment: orders.filter(
            (o) =>
              o.payment_status === "paid" &&
              o.fulfillment_status !== "fulfilled",
          ).length,
          grossSales: orders
            .filter((o) => o.payment_status === "paid")
            .reduce((sum, order) => sum + order.total, 0),
        },
        recentOrders: orders.slice(0, 5),
      });
    }
    if (resource === "paintings") {
      if (request.method === "GET") {
        const query = supabase
          .from("products")
          .select("*,painting_images(*),product_variants(*)")
          .order("updated_at", { ascending: false });
        const { data, error } = id
          ? await query.eq("id", id).single()
          : await query;
        if (error)
          throw Object.assign(error, {
            status: error.code === "PGRST116" ? 404 : 500,
          });
        const signImages = async (painting: typeof data) => {
          const sign = async (path?: string | null) =>
            path
              ? ((
                  await supabase.storage
                    .from("paintings")
                    .createSignedUrl(path, 3600)
                ).data?.signedUrl ?? "")
              : "";
          const paintingImages = await Promise.all(
            (painting.painting_images ?? []).map(
              async (image: {
                storage_path: string;
                thumbnail_path?: string;
                gallery_path?: string;
                large_path?: string;
                is_primary?: boolean;
              }) => {
                const [masterUrl, thumbnailUrl, galleryUrl, largeUrl] =
                  await Promise.all([
                    sign(image.storage_path),
                    sign(image.thumbnail_path),
                    sign(image.gallery_path),
                    sign(image.large_path),
                  ]);
                return {
                  ...image,
                  public_url: galleryUrl || largeUrl || masterUrl,
                  thumbnail_url: thumbnailUrl || galleryUrl || masterUrl,
                  large_url: largeUrl || masterUrl,
                  master_url: masterUrl,
                };
              },
            ),
          );
          return {
            ...painting,
            image:
              paintingImages.find((image) => image.is_primary)?.public_url ??
              painting.image,
            painting_images: paintingImages,
          };
        };
        return response.json(
          id
            ? { painting: await signImages(data) }
            : { paintings: await Promise.all(data.map(signImages)) },
        );
      }
      if (request.method === "POST") {
        const product = validateProduct(request.body ?? {});
        const { product_variants, ...productRow } = product;
        if (["published", "sold"].includes(product.status))
          throw Object.assign(
            new Error(
              "Save the painting as a draft and add an image before publishing.",
            ),
            { status: 422 },
          );
        const submissionId = request.body?.submission_id;
        if (
          typeof submissionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            submissionId,
          )
        )
          throw Object.assign(new Error("Invalid painting submission."), {
            status: 422,
          });
        const productId = submissionId;
        const existingSubmission = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();
        if (existingSubmission.data)
          return response.status(200).json({
            painting: existingSubmission.data,
            duplicate_submission: true,
          });
        const { data, error } = await supabase
          .from("products")
          .insert({ id: productId, image: "", ...productRow })
          .select()
          .single();
        if (error)
          throw Object.assign(
            new Error(
              error.code === "23505"
                ? "That slug is already in use."
                : "Painting could not be created.",
            ),
            { status: error.code === "23505" ? 409 : 400 },
          );
        if (product_variants.length) {
          const variants = await supabase.from("product_variants").insert(
            product_variants.map((variant) => ({
              ...variant,
              product_id: productId,
            })),
          );
          if (variants.error) {
            await supabase.from("products").delete().eq("id", productId);
            throw new Error("Print sizes could not be saved.");
          }
        }
        return response.status(201).json({ painting: data });
      }
      if (request.method === "PATCH" && id) {
        const existing = await supabase
          .from("products")
          .select("sold,status,inventory,reserved_until")
          .eq("id", id)
          .single();
        if (existing.error)
          throw Object.assign(new Error("Painting not found."), {
            status: 404,
          });
        const product = validateProduct(request.body ?? {});
        const { product_variants, ...productRow } = product;
        if (["published", "sold"].includes(product.status)) {
          const { data: publicationImages, error: imageError } = await supabase
            .from("painting_images")
            .select("id,alt_text,is_primary")
            .eq("painting_id", id);
          const { data: existingImage } = await supabase
            .from("products")
            .select("image")
            .eq("id", id)
            .single();
          if (
            imageError ||
            ((!publicationImages || publicationImages.length === 0) &&
              !String(existingImage?.image ?? "").startsWith("/"))
          )
            throw Object.assign(
              new Error("Add at least one artwork image before publishing."),
              { status: 422 },
            );
          if (
            publicationImages?.some((image) => !image.alt_text.trim()) ||
            (publicationImages?.length &&
              !publicationImages.some((image) => image.is_primary))
          )
            throw Object.assign(
              new Error(
                "Every image needs alt text and one image must be the cover before publishing.",
              ),
              { status: 422 },
            );
        }
        if (
          existing.data.reserved_until &&
          new Date(existing.data.reserved_until) > new Date() &&
          (product.status !== existing.data.status ||
            product.inventory !== existing.data.inventory)
        )
          throw Object.assign(
            new Error(
              "Inventory and publication status cannot change while this original is reserved in checkout.",
            ),
            { status: 409 },
          );
        if (
          existing.data.sold &&
          product.status !== "sold" &&
          request.body?.confirm_restore_sold !== true
        )
          throw Object.assign(
            new Error(
              "Restoring a sold original requires explicit confirmation.",
            ),
            { status: 409 },
          );
        const { data, error } = await supabase
          .from("products")
          .update({ ...productRow, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error)
          throw Object.assign(
            new Error(
              error.code === "23505"
                ? "That slug is already in use."
                : "Painting could not be updated.",
            ),
            { status: error.code === "23505" ? 409 : 400 },
          );
        const removed = await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", id);
        if (removed.error)
          throw new Error("Existing print sizes could not be updated.");
        if (product_variants.length) {
          const variants = await supabase.from("product_variants").insert(
            product_variants.map((variant) => ({
              ...variant,
              product_id: id,
            })),
          );
          if (variants.error)
            throw new Error("Print sizes could not be updated.");
        }
        return response.json({ painting: data });
      }
      if (request.method === "DELETE" && id) {
        const { error } = await supabase
          .from("products")
          .update({
            status: "archived",
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
        return response.json({ archived: true });
      }
    }
    if (resource === "orders") {
      if (request.method === "GET") {
        const query = supabase
          .from("orders")
          .select(id ? "*,order_items(*)" : "*,order_items(id)")
          .order("created_at", { ascending: false });
        const { data, error } = id
          ? await query.eq("id", id).single()
          : await query;
        if (error) throw Object.assign(error, { status: 404 });
        return response.json(id ? { order: data } : { orders: data });
      }
      if (request.method === "PATCH" && id) {
        const allowed = ["unfulfilled", "packing", "fulfilled"];
        if (!allowed.includes(request.body?.fulfillment_status))
          throw Object.assign(new Error("Invalid fulfillment status."), {
            status: 422,
          });
        const trackingNumber = String(request.body.tracking_number ?? "");
        const shippingCarrier = String(request.body.shipping_carrier ?? "");
        const fulfillmentNote = String(request.body.fulfillment_note ?? "");
        if (
          trackingNumber.length > 200 ||
          shippingCarrier.length > 100 ||
          fulfillmentNote.length > 5000
        )
          throw Object.assign(new Error("Fulfillment details are too long."), {
            status: 422,
          });
        const { data, error } = await supabase
          .from("orders")
          .update({
            fulfillment_status: request.body.fulfillment_status,
            tracking_number: trackingNumber,
            shipping_carrier: shippingCarrier,
            fulfillment_note: fulfillmentNote,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return response.json({ order: data });
      }
    }
    if (resource === "images") {
      if (request.method === "POST" && request.query.action === "sign") {
        const {
          paintingId,
          filename,
          mimeType,
          fileSize,
          assetId,
          version = "original",
        } = request.body ?? {};
        const max = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? 40) * 1024 * 1024;
        const validAssetId =
          typeof assetId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            assetId,
          );
        const validVersion = [
          "original",
          "thumbnail",
          "gallery",
          "large",
        ].includes(version);
        if (
          typeof paintingId !== "string" ||
          typeof filename !== "string" ||
          !allowedTypes.includes(mimeType) ||
          !validAssetId ||
          !validVersion ||
          (version !== "original" && mimeType !== "image/webp") ||
          !Number.isInteger(fileSize) ||
          fileSize < 1 ||
          fileSize > max
        )
          throw Object.assign(
            new Error("Choose a supported image within the upload limit."),
            { status: 422 },
          );
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("id", paintingId);
        if (!count)
          throw Object.assign(new Error("Painting not found."), {
            status: 404,
          });
        const extension =
          version === "original"
            ? cleanName(filename).split(".").pop() || "image"
            : "webp";
        const path = `paintings/${paintingId}/${version}/${assetId}.${extension}`;
        const { data, error } = await supabase.storage
          .from("paintings")
          .createSignedUploadUrl(path);
        if (error) throw error;
        return response.json({
          path,
          assetId,
          token: data.token,
          signedUrl: data.signedUrl,
        });
      }
      if (request.method === "POST" && request.query.action === "complete") {
        const body = request.body ?? {};
        const max = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? 40) * 1024 * 1024;
        if (
          !body.storage_path?.startsWith(
            `paintings/${body.painting_id}/original/`,
          ) ||
          body.storage_path.includes("..") ||
          !allowedTypes.includes(body.mime_type) ||
          !Number.isInteger(body.width) ||
          body.width < 1 ||
          !Number.isInteger(body.height) ||
          body.height < 1 ||
          !Number.isInteger(body.file_size) ||
          body.file_size < 1 ||
          body.file_size > max
        )
          throw Object.assign(new Error("Invalid image metadata."), {
            status: 422,
          });
        const assetName = String(body.storage_path)
          .split("/")
          .pop()
          ?.split(".")[0];
        const derivedPaths = [
          ["thumbnail", body.thumbnail_path],
          ["gallery", body.gallery_path],
          ["large", body.large_path],
        ] as const;
        for (const [version, derivedPath] of derivedPaths) {
          if (
            typeof derivedPath !== "string" ||
            derivedPath !==
              `paintings/${body.painting_id}/${version}/${assetName}.webp` ||
            derivedPath.includes("..")
          )
            throw Object.assign(new Error("Invalid responsive image path."), {
              status: 422,
            });
        }
        const pathParts = String(body.storage_path).split("/");
        const filename = pathParts.pop()!;
        const stored = await supabase.storage
          .from("paintings")
          .list(pathParts.join("/"), { search: filename, limit: 2 });
        if (
          stored.error ||
          !stored.data.some((entry) => entry.name === filename)
        )
          throw Object.assign(new Error("Uploaded image was not found."), {
            status: 422,
          });
        for (const [, derivedPath] of derivedPaths) {
          const parts = derivedPath.split("/");
          const derivedName = parts.pop()!;
          const found = await supabase.storage
            .from("paintings")
            .list(parts.join("/"), { search: derivedName, limit: 2 });
          if (
            found.error ||
            !found.data.some((entry) => entry.name === derivedName)
          )
            throw Object.assign(
              new Error("A responsive image upload was not found."),
              { status: 422 },
            );
        }
        const downloaded = await supabase.storage
          .from("paintings")
          .download(body.storage_path);
        if (downloaded.error || !downloaded.data)
          throw Object.assign(
            new Error("Uploaded image could not be verified."),
            {
              status: 422,
            },
          );
        const uploadedBytes = new Uint8Array(
          await downloaded.data.slice(0, 16).arrayBuffer(),
        );
        if (
          downloaded.data.size !== body.file_size ||
          !hasImageSignature(uploadedBytes, body.mime_type)
        ) {
          await supabase.storage.from("paintings").remove([body.storage_path]);
          throw Object.assign(
            new Error(
              "The uploaded file content does not match its image type.",
            ),
            { status: 422 },
          );
        }
        const { count } = await supabase
          .from("painting_images")
          .select("id", { count: "exact", head: true })
          .eq("painting_id", body.painting_id);
        const { data, error } = await supabase
          .from("painting_images")
          .insert({
            painting_id: body.painting_id,
            storage_path: body.storage_path,
            original_filename: String(body.original_filename ?? ""),
            thumbnail_path: body.thumbnail_path,
            gallery_path: body.gallery_path,
            large_path: body.large_path,
            alt_text: String(body.alt_text ?? ""),
            image_type: imageTypes.includes(body.image_type)
              ? body.image_type
              : "other",
            sort_order: Number.isInteger(body.sort_order)
              ? body.sort_order
              : (count ?? 0),
            is_primary: count === 0,
            width: body.width,
            height: body.height,
            file_size: body.file_size,
            mime_type: body.mime_type,
          })
          .select()
          .single();
        if (error) {
          await supabase.storage
            .from("paintings")
            .remove([
              body.storage_path,
              ...derivedPaths.map(([, path]) => path),
            ]);
          throw error;
        }
        if (count === 0)
          await supabase
            .from("products")
            .update({ image: body.storage_path })
            .eq("id", body.painting_id);
        const signed = await supabase.storage
          .from("paintings")
          .createSignedUrl(data.storage_path, 3600);
        return response.status(201).json({
          image: { ...data, public_url: signed.data?.signedUrl ?? "" },
        });
      }
      if (request.method === "POST" && request.query.action === "discard") {
        const { painting_id, storage_path } = request.body ?? {};
        if (
          typeof painting_id !== "string" ||
          typeof storage_path !== "string" ||
          !storage_path.startsWith(`paintings/${painting_id}/`) ||
          storage_path.includes("..")
        )
          throw Object.assign(new Error("Invalid image path."), {
            status: 422,
          });
        const { count } = await supabase
          .from("painting_images")
          .select("id", { count: "exact", head: true })
          .eq("storage_path", storage_path);
        if (count)
          throw Object.assign(new Error("Image is already in use."), {
            status: 409,
          });
        const removed = await supabase.storage
          .from("paintings")
          .remove([storage_path]);
        if (removed.error) throw removed.error;
        return response.status(204).end();
      }
      if (request.method === "PATCH" && request.query.action === "reorder") {
        const { painting_id, image_ids } = request.body ?? {};
        if (
          typeof painting_id !== "string" ||
          !Array.isArray(image_ids) ||
          !image_ids.length ||
          image_ids.some((imageId) => typeof imageId !== "string")
        )
          throw Object.assign(new Error("Invalid image order."), {
            status: 422,
          });
        const { error } = await supabase.rpc("reorder_painting_images", {
          p_painting_id: painting_id,
          p_image_ids: image_ids,
        });
        if (error)
          throw Object.assign(new Error("Images could not be reordered."), {
            status: 422,
          });
        return response.json({ reordered: true });
      }
      if (request.method === "PATCH" && id) {
        const { painting_id, alt_text, image_type, sort_order, is_primary } =
          request.body ?? {};
        if (
          typeof painting_id !== "string" ||
          !imageTypes.includes(image_type) ||
          typeof alt_text !== "string" ||
          alt_text.length > 500 ||
          !Number.isInteger(Number(sort_order))
        )
          throw Object.assign(new Error("Invalid image metadata."), {
            status: 422,
          });
        if (is_primary) {
          const primary = await supabase.rpc("set_primary_painting_image", {
            p_painting_id: painting_id,
            p_image_id: id,
          });
          if (primary.error)
            throw Object.assign(
              new Error("Cover image could not be changed."),
              {
                status: 422,
              },
            );
        }
        const { data, error } = await supabase
          .from("painting_images")
          .update({
            alt_text: String(alt_text ?? ""),
            image_type,
            sort_order: Number(sort_order),
          })
          .eq("id", id)
          .eq("painting_id", painting_id)
          .select()
          .single();
        if (error) throw error;
        return response.json({ image: data });
      }
      if (request.method === "DELETE" && id) {
        const { data: image, error } = await supabase
          .from("painting_images")
          .select("*")
          .eq("id", id)
          .single();
        if (error)
          throw Object.assign(new Error("Image not found."), { status: 404 });
        const deleted = await supabase
          .from("painting_images")
          .delete()
          .eq("id", id);
        if (deleted.error) throw deleted.error;
        const removed = await supabase.storage
          .from("paintings")
          .remove(
            [
              image.storage_path,
              image.thumbnail_path,
              image.gallery_path,
              image.large_path,
            ].filter((path): path is string => Boolean(path)),
          );
        if (removed.error) {
          await supabase.from("painting_images").insert(image);
          throw new Error("Image storage could not be removed.");
        }
        if (image.is_primary) {
          const { data: replacement } = await supabase
            .from("painting_images")
            .select("id")
            .eq("painting_id", image.painting_id)
            .order("sort_order")
            .limit(1)
            .maybeSingle();
          if (replacement)
            await supabase.rpc("set_primary_painting_image", {
              p_painting_id: image.painting_id,
              p_image_id: replacement.id,
            });
          else
            await supabase
              .from("products")
              .update({ image: "" })
              .eq("id", image.painting_id);
        }
        return response.status(204).end();
      }
    }
    return response.status(404).json({ error: "Not found." });
  } catch (error) {
    const safe = safeError(error);
    console.error(
      "Admin request failed:",
      safe.status,
      error instanceof Error ? error.message : "Unknown",
    );
    const fields =
      typeof error === "object" && error && "fields" in error
        ? error.fields
        : undefined;
    return response.status(safe.status).json({ error: safe.message, fields });
  }
}

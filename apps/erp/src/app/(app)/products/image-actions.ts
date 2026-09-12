"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createUploadTicket, destroyImage } from "@/lib/cloudinary";
import type { UploadTicket } from "@/lib/cloudinary";

/*
 * Photographs, attached to a product from the ERP.
 *
 * The upload itself does not happen here — the browser sends the file straight
 * to Cloudinary with a ticket this file signs (see lib/cloudinary.ts). What
 * these actions do is decide WHO may upload, and record the result.
 *
 * Every one of them starts with requireAdmin(). A Server Action compiles to a
 * public POST endpoint: the fact that the only link to it sits behind a login
 * protects nothing, and an unguarded signing action would hand anyone on the
 * internet write access to the Cloudinary account.
 */

type Result = { ok: true } | { ok: false; error: string };

/** Cloudinary ids this app issues. Anything else was not minted here. */
const OUR_ID = /^products\/[A-Za-z0-9._-]{1,40}\/[a-z0-9]{4,40}$/;

/**
 * A signed ticket for one upload.
 *
 * Scoped to a product that actually exists, so a ticket cannot be minted for
 * an arbitrary path, and so the id carries the SKU the file belongs to.
 */
export async function requestUpload(
  productId: string,
): Promise<{ ok: true; ticket: UploadTicket } | { ok: false; error: string }> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("sku")
    .eq("id", productId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That product no longer exists." };

  try {
    return { ok: true, ticket: await createUploadTicket(data.sku) };
  } catch (cause) {
    /* Missing credentials land here. Say so plainly — this is the one failure
       the owner can actually fix, and "Invalid Signature" would not help. */
    return { ok: false, error: (cause as Error).message };
  }
}

/**
 * Record a photograph the browser has already uploaded.
 *
 * Runs AFTER Cloudinary has accepted the file, so the dimensions and byte
 * count are Cloudinary's own report of what it stored — which is what makes
 * "was the master downsized?" answerable later.
 */
export async function attachImage(input: {
  productId: string;
  storedId: string;
  alt: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}): Promise<Result> {
  await requireAdmin();

  /* The id is supplied by the browser, which we signed a ticket for but do not
     otherwise control. Reject anything that is not the shape this app mints —
     a row pointing outside products/ would be a photograph nobody can find. */
  if (!OUR_ID.test(input.storedId)) {
    return { ok: false, error: "That image id was not issued by this app." };
  }

  const supabase = await createClient();

  /* Append, rather than defaulting to 0 and tying every photograph for first
     place. `position` is what the storefront orders by, and the first row is
     the hero — so a new upload must land at the end, not silently become the
     card thumbnail. */
  const { data: last } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", input.productId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("product_images").insert({
    product_id: input.productId,
    public_id: input.storedId,
    alt: input.alt.trim(),
    position: (last?.position ?? -1) + 1,
    width: input.width ?? null,
    height: input.height ?? null,
    format: input.format ?? null,
    bytes: input.bytes ?? null,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That photograph is already on this product."
          : error.message,
    };
  }

  revalidatePath(`/products/${input.productId}`);
  return { ok: true };
}

export async function saveAlt(imageId: string, alt: string): Promise<Result> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .update({ alt: alt.trim() })
    .eq("id", imageId)
    .select("product_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (data) revalidatePath(`/products/${data.product_id}`);
  return { ok: true };
}

/**
 * Move a photograph one place up or down.
 *
 * A swap of two `position` values rather than a renumber, because a renumber
 * would rewrite every row to change one pair — and because the pair is all
 * that has to be true for the order to be right.
 */
export async function moveImage(
  imageId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireAdmin();

  const supabase = await createClient();

  const { data: self, error: selfError } = await supabase
    .from("product_images")
    .select("id, product_id, position")
    .eq("id", imageId)
    .maybeSingle();

  if (selfError) return { ok: false, error: selfError.message };
  if (!self) return { ok: false, error: "That photograph is gone." };

  /* The neighbour by position, not by index — positions are not guaranteed
     contiguous once rows have been deleted. */
  const { data: neighbour } = await supabase
    .from("product_images")
    .select("id, position")
    .eq("product_id", self.product_id)
    .order("position", { ascending: direction === "down" })
    [direction === "up" ? "lt" : "gt"]("position", self.position)
    .limit(1)
    .maybeSingle();

  /* Already first or last. Not an error — the button simply had nothing to do. */
  if (!neighbour) return { ok: true };

  const a = await supabase
    .from("product_images")
    .update({ position: neighbour.position })
    .eq("id", self.id);
  if (a.error) return { ok: false, error: a.error.message };

  const b = await supabase
    .from("product_images")
    .update({ position: self.position })
    .eq("id", neighbour.id);
  if (b.error) return { ok: false, error: b.error.message };

  revalidatePath(`/products/${self.product_id}`);
  return { ok: true };
}

/**
 * Remove a photograph.
 *
 * The ROW goes first and the Cloudinary file second, and the order is the
 * whole point: a row pointing at a deleted file is a broken image on the shop,
 * while a file with no row is a few kilobytes nobody sees. If the second step
 * fails the first still stands.
 */
export async function removeImage(imageId: string): Promise<Result> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("product_id, public_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true };

  try {
    await destroyImage(data.public_id);
  } catch {
    /* Orphaned in Cloudinary. Deliberately not surfaced: the photograph is off
       the shop, which is what the owner asked for, and there is nothing they
       could do about the leftover file from here. */
  }

  revalidatePath(`/products/${data.product_id}`);
  return { ok: true };
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import {
  attachImage,
  moveImage,
  removeImage,
  requestUpload,
  saveAlt,
} from "../image-actions";

export type ProductImage = {
  id: string;
  public_id: string;
  alt: string;
  position: number;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
};

/*
 * Cloudinary's own ceiling on the free plan. Checked here so a 14 MB photo
 * fails in a sentence rather than after a slow upload and a raw API error.
 */
const MAX_BYTES = 10 * 1024 * 1024;

function prettyBytes(n: number | null) {
  if (!n) return null;
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}

/*
 * The product's photographs.
 *
 * THE FILE GOES BROWSER → CLOUDINARY, never through the ERP server. The server
 * signs a ticket; this component posts the bytes. See lib/cloudinary.ts for
 * why that matters on a Worker.
 *
 * Uploads run one at a time rather than in parallel. A phone on Bangladeshi
 * mobile data uploading five 3 MB photographs at once is five stalled requests
 * and no feedback; one at a time is slower on paper and finishes sooner in
 * practice, and it lets the progress line name the file it is actually on.
 */
export function Photographs({
  productId,
  images,
  cloudName,
  folder,
  configured,
}: {
  productId: string;
  images: ProductImage[];
  cloudName: string;
  folder: string;
  configured: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const thumb = (publicId: string) =>
    `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_240,ar_1:1,c_fill,g_auto/${folder}/${publicId}`;

  async function uploadOne(file: File) {
    if (file.size > MAX_BYTES) {
      throw new Error(
        `${file.name} is ${prettyBytes(file.size)} — the limit is 10 MB.`,
      );
    }

    const ticket = await requestUpload(productId, {
      fileName: file.name,
      mimeType: file.type,
    });
    if (!ticket.ok) throw new Error(ticket.error);

    /*
     * Exactly the fields the server signed, and not one more: every parameter
     * except file, cloud_name, resource_type and api_key has to be covered by
     * the signature, so adding a folder, a tag or a quality here turns every
     * upload into "Invalid Signature" — and omitting one the server DID sign
     * fails the same way.
     *
     * The only ingest transformation this app ever asks for is `format: jpg`,
     * and only for HEIC, which Cloudinary cannot reliably resize. Everything
     * else is stored exactly as given, so the master stays the best copy that
     * exists and the storefront derives every rendition from it.
     */
    const form = new FormData();
    form.set("file", file);
    form.set("api_key", ticket.ticket.apiKey);
    form.set("public_id", ticket.ticket.publicId);
    form.set("timestamp", String(ticket.ticket.timestamp));
    /* Present only when the server signed it — every signed parameter must be
       sent, and an unsigned one is rejected just as hard. */
    if (ticket.ticket.transcode) form.set("format", "jpg");
    form.set("signature", ticket.ticket.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${ticket.ticket.cloudName}/image/upload`,
      { method: "POST", body: form },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body?.error?.message ?? `Upload failed (${response.status}).`,
      );
    }

    const saved = await attachImage({
      productId,
      storedId: ticket.ticket.storedId,
      /* Alt text is written after the upload, on the row. Blocking the upload
         on a text field the owner has not thought about yet is how photographs
         end up not uploaded at all. */
      alt: "",
      width: body.width,
      height: body.height,
      format: body.format,
      bytes: body.bytes,
    });
    if (!saved.ok) throw new Error(saved.error);
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;
    setError(null);

    for (const [index, file] of files.entries()) {
      setBusy(`Uploading ${file.name} (${index + 1} of ${files.length})…`);
      try {
        await uploadOne(file);
      } catch (cause) {
        setError((cause as Error).message);
        break;
      }
    }

    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That did not work.");
      else setError(null);
      router.refresh();
    });
  }

  if (!configured) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Photograph uploads are off because this deployment has no Cloudinary
        credentials. Set <code>CLOUDINARY_CLOUD_NAME</code>,{" "}
        <code>CLOUDINARY_API_KEY</code> and <code>CLOUDINARY_API_SECRET</code>,
        then reload.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          disabled={busy !== null}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-700 disabled:opacity-50 dark:file:bg-neutral-100 dark:file:text-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Straight from your phone is fine. HEIC is converted to JPEG on the way
          in, because Cloudinary cannot reliably resize an iPhone HEIC;
          everything else is stored exactly as given. The shop makes its own
          sizes from whatever is stored.
        </p>
      </div>

      {busy && <p className="text-sm text-neutral-600">{busy}</p>}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No photographs yet. Until one is added, the shop falls back to
          whatever this product has in the code.
        </p>
      ) : (
        <ul className="space-y-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary
                  is the optimiser here, exactly as on the storefront; next/image
                  in front of it would be two resizes for one thumbnail. */}
              <img
                src={thumb(image.public_id)}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-md object-cover"
              />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {index === 0 && (
                    <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[0.625rem] font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                      MAIN
                    </span>
                  )}
                  <span className="truncate text-xs text-neutral-500">
                    {[
                      image.width && image.height
                        ? `${image.width} × ${image.height}`
                        : null,
                      image.format?.toUpperCase(),
                      prettyBytes(image.bytes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>

                <Input
                  defaultValue={image.alt}
                  placeholder="Describe the photograph"
                  aria-label="Alt text"
                  onBlur={(event) => {
                    const next = event.target.value;
                    if (next !== image.alt) run(() => saveAlt(image.id, next));
                  }}
                />

                <div className="flex gap-2">
                  <Button
                    tone="ghost"
                    disabled={index === 0 || pending}
                    onClick={() => run(() => moveImage(image.id, "up"))}
                  >
                    ↑
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={index === images.length - 1 || pending}
                    onClick={() => run(() => moveImage(image.id, "down"))}
                  >
                    ↓
                  </Button>
                  <Button
                    tone="danger"
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Remove this photograph from the shop?")) {
                        run(() => removeImage(image.id));
                      }
                    }}
                    className="ml-auto"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-500">
        The first photograph is the one customers see on the shop grid. Use ↑ to
        promote a different one.
      </p>
    </div>
  );
}

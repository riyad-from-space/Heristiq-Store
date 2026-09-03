"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { ProductImage as ProductImageType } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

/*
 * PDP gallery.
 *
 * Phone and desktop are genuinely different interactions, so they are two
 * layouts rather than one compromise:
 *
 *  - Phone: a full-width horizontal snap rail with dots. Swiping is what a
 *    customer's thumb already expects, and it needs no chrome.
 *  - Desktop (sm+): one large image with thumbnails beneath, and click to open
 *    a full-screen zoom.
 *
 * Zoom is a dialog rather than a hover-magnifier: on a phone there is no hover,
 * and jewellery detail is what people actually want to see close up.
 */
export function Gallery({
  images,
  name,
  sku,
}: {
  images: ProductImageType[];
  name: string;
  sku: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  /* An unphotographed product still needs a frame, or the PDP collapses. */
  const shots = images.length > 0 ? images : [{ id: "", alt: name }];
  const current = shots[Math.min(index, shots.length - 1)];

  return (
    <>
      {/* ---------------------------------------------------------- phone */}
      <div className="sm:hidden">
        <div
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(event) => {
            const el = event.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {shots.map((image, i) => (
            <div key={image.id || i} className="w-full shrink-0 snap-center">
              <ProductImage
                image={image.id ? image : undefined}
                alt={image.alt}
                sizes="100vw"
                priority={i === 0}
                placeholderLabel={sku}
              />
            </div>
          ))}
        </div>

        {shots.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5">
            {shots.map((image, i) => (
              <span
                key={image.id || i}
                aria-hidden
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-ink" : "w-1.5 bg-line-strong",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- desktop */}
      <div className="hidden sm:block">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="group relative block w-full cursor-zoom-in"
          aria-label="Open larger image"
        >
          <ProductImage
            image={current.id ? current : undefined}
            alt={current.alt}
            sizes="(min-width: 1024px) 46vw, 50vw"
            priority
            placeholderLabel={sku}
          />
          <span className="bg-paper/90 text-ink absolute right-3 bottom-3 grid size-9 place-items-center rounded-sm opacity-0 transition group-hover:opacity-100">
            <ZoomIn size={16} />
          </span>
        </button>

        {shots.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-3">
            {shots.map((image, i) => (
              <button
                key={image.id || i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "border transition-colors",
                  i === index
                    ? "border-ink"
                    : "border-transparent hover:border-line-strong",
                )}
              >
                <ProductImage
                  image={image.id ? image : undefined}
                  alt=""
                  sizes="10vw"
                  maxWidth={320}
                  crop="square"
                  placeholderLabel={sku}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog.Root open={zoomOpen} onOpenChange={setZoomOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-sea/95 fixed inset-0 z-[60]" />
          <Dialog.Content className="fixed inset-0 z-[60] flex flex-col">
            <Dialog.Title className="sr-only">{name}</Dialog.Title>

            <div className="flex items-center justify-end p-4">
              <Dialog.Close
                aria-label="Close"
                className="text-bone grid size-11 place-items-center"
              >
                <X size={22} />
              </Dialog.Close>
            </div>

            <div className="flex flex-1 items-center justify-center px-4 pb-4">
              {/*
               * A single large file, not a srcset. This is the one place a
               * customer has asked for the biggest version there is, so
               * guessing a smaller one from viewport width would defeat the
               * purpose of the interaction.
               */}
              <img
                src={
                  cloudinaryUrl(current.id, 1600, "natural") ??
                  undefined
                }
                alt={current.alt}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {shots.length > 1 && (
              <div className="flex items-center justify-center gap-6 pb-8">
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() =>
                    setIndex((i) => (i - 1 + shots.length) % shots.length)
                  }
                  className="text-bone grid size-11 place-items-center"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="text-bone/70 text-xs tnum">
                  {index + 1} / {shots.length}
                </span>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => setIndex((i) => (i + 1) % shots.length)}
                  className="text-bone grid size-11 place-items-center"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

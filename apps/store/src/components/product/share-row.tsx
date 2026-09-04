"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import {
  MessengerIcon,
  WhatsAppIcon,
} from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";

/*
 * Share.
 *
 * Almost every visit starts in an Instagram or TikTok in-app browser, and the
 * way a piece spreads is one friend sending it to another in WhatsApp or
 * Messenger. So those two get explicit buttons rather than being buried behind
 * a generic sheet.
 *
 * The native share sheet is offered when the browser has one (it is the best
 * option on a phone, and it includes Instagram DMs, which have no web
 * intent URL). Copy-link is the fallback that always works.
 */
export function ShareRow({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = `${title} — ${url}`;

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* The user dismissed the sheet. Not an error, and not worth a toast. */
        return;
      }
    }
    await copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard is blocked in some in-app browsers. Nothing useful to do. */
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-eyebrow text-ink-faint mr-2 uppercase">Share</span>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        className="hover:bg-shell grid size-10 place-items-center rounded-sm transition"
      >
        <WhatsAppIcon size={18} />
      </a>

      {/*
       * Messenger's web share dialog needs an app id, which this site does not
       * have; fb.com/sharer works from any browser and opens Messenger when the
       * app is installed, so it is the honest choice.
       */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook or Messenger"
        className="hover:bg-shell grid size-10 place-items-center rounded-sm transition"
      >
        <MessengerIcon size={18} />
      </a>

      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="hover:bg-shell grid size-10 place-items-center rounded-sm transition"
      >
        {copied ? (
          <Check size={17} className="text-success" />
        ) : (
          <Link2 size={17} />
        )}
      </button>

      <button
        type="button"
        onClick={share}
        aria-label="More sharing options"
        className="hover:bg-shell grid size-10 place-items-center rounded-sm transition sm:hidden"
      >
        <Share2 size={17} />
      </button>
    </div>
  );
}

/**
 * What customers actually said.
 *
 * EMPTY, AND THAT IS NOT AN OVERSIGHT. The brief asked for a section showing
 * that real customers love the pieces. There are no reviews in this system —
 * no table, no import, nothing in the ERP — so the only way to fill this today
 * would be to write them, and /about promises in as many words: "we do not run
 * fake discounts, we do not invent reviews, and we do not take payment for
 * anything we cannot ship."
 *
 * A shop that invents its first reviews has nothing left to say when the real
 * ones disagree, and the promise on /about becomes the most obvious lie on the
 * site. So the section renders an honest invitation until this array has
 * something real in it, and becomes the review wall the moment it does.
 *
 * HOW TO ADD ONE. Paste what the customer actually wrote — WhatsApp, Instagram,
 * a message through /contact. Trim it, do not improve it; the small
 * infelicities are most of what makes a review read as real.
 *
 *   {
 *     quote: "Wore it to my cousin's mehendi and three people asked.",
 *     name: "Samanta",
 *     rating: 5,
 *     sku: "WC-005",              // optional — shows the piece beside it
 *     photo: "reviews/samanta",   // optional — a Cloudinary id, if they sent one
 *   }
 *
 * Ask before publishing a name or a photograph. A first name is usually fine
 * and initials always are; a photograph of someone is theirs, not the shop's.
 */
export type Review = {
  /** Their words, trimmed but not rewritten. */
  quote: string;
  /** First name, or initials. Never a full name without asking. */
  name: string;
  /** 1–5. Only what they actually gave. */
  rating: 1 | 2 | 3 | 4 | 5;
  /** SKU of the piece, so the review can sit beside the thing it is about. */
  sku?: string;
  /** Cloudinary id of a photograph THEY sent, published with permission. */
  photo?: string;
};

export const reviews: Review[] = [];

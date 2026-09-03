/*
 * ============================================================================
 *  PLACEHOLDER CONTENT — REPLACE BEFORE LAUNCH
 * ============================================================================
 *
 * These are SAMPLE messages written to make the section designable. They are
 * NOT real customers. Publishing invented reviews as genuine is deceptive and,
 * in most markets, unlawful.
 *
 * Before the site goes live, either:
 *   a) replace every entry with a real message you have permission to quote
 *      (a DM screenshot is enough — keep it), or
 *   b) empty this array. The section renders nothing when it is empty, and the
 *      home page reads perfectly well without it.
 *
 * See README.md → "Before launch".
 */
export type Testimonial = {
  quote: string;
  /** First name and city is enough, and is what a real DM gives you. */
  name: string;
  city: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "Ordered on Sunday night and it reached Chattogram on Tuesday. Paid the delivery man, no advance. The moon one is even nicer in person.",
    name: "Nusrat",
    city: "Chattogram",
  },
  {
    quote:
      "I was worried the plating would go dull in a week. Two months of daily wear and it still looks the same.",
    name: "Tasnim",
    city: "Dhanmondi, Dhaka",
  },
  {
    quote:
      "Bought the starfish for my sister's birthday. She has not taken it off since. Buying the shell one next.",
    name: "Farhana",
    city: "Sylhet",
  },
];

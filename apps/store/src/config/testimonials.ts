/*
 * ============================================================================
 *  PLACEHOLDER CONTENT — REPLACE BEFORE LAUNCH
 * ============================================================================
 *
 * These are SAMPLE messages written to make the section designable. They are
 * NOT real customers. Publishing invented reviews as genuine is deceptive and,
 * in most markets, unlawful.
 *
 * So the section is now OFF BY DEFAULT. The samples stay here because they
 * make the layout designable, but nothing reaches a customer until someone
 * asserts the quotes are real by flipping the flag below. Shipping invented
 * reviews should take a deliberate act, not the absence of one.
 *
 * To turn it on:
 *   1. replace every entry with a real message you have permission to quote
 *      (a DM screenshot is enough — keep it), and
 *   2. set TESTIMONIALS_ARE_REAL to true.
 *
 * Or leave it off. The home page reads perfectly well without the section.
 *
 * See README.md → "Before launch".
 */

/**
 * Assert that every quote below is a real message from a real customer, quoted
 * with their permission. Nothing renders while this is false.
 */
export const TESTIMONIALS_ARE_REAL = false;
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

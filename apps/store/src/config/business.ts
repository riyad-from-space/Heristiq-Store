/**
 * The business's own details, and the only file that needs a human's answers.
 *
 * Everything here is rendered on the About, Contact, Shipping and Policies
 * pages, and several of these values are legally load-bearing in Bangladesh —
 * a returns window, a trading address, a complaint route. So they live in one
 * file with an explicit `REVIEW` marker on anything invented, rather than
 * being scattered as prose across six pages where a wrong claim is easy to
 * miss.
 *
 * The `review` list at the bottom is read by the /policies pages and rendered
 * as a visible notice while any of it is still a placeholder — a policy page
 * that quietly states an invented address is worse than one that admits it is
 * a draft.
 */
export const business = {
  /** Trading name, as customers know it. */
  name: "Heristiq",
  /** Legal entity, if different. Same for a sole proprietorship. */
  legalName: "Heristiq",

  /*
   * REVIEW — a Bangladeshi e-commerce site is expected to show a real trading
   * address and a contact number. Leave `null` and the pages will say a
   * postal address is available on request rather than invent one.
   */
  address: null as string | null,
  tradeLicence: null as string | null,
  /** REVIEW — only if the business is VAT-registered. */
  binNumber: null as string | null,

  /** Founded, for the About page's "since" line. */
  since: 2026,

  /*
   * Returns and refunds. These are promises, so they are config rather than
   * prose: changing the window must not mean editing three pages.
   */
  returns: {
    /** Days from delivery to report a problem. */
    windowDays: 3,
    /** Days to process an approved refund. */
    refundDays: 7,
    /**
     * Body jewellery cannot be resold once worn, so a change-of-mind return is
     * not offered — only faulty, damaged or wrong items. Stated plainly
     * because a hidden no-returns policy is what generates disputes.
     */
    changeOfMind: false,
  },

  /** How long a customer waits for a reply, so the promise is explicit. */
  responseHours: 24,
} as const;

/**
 * Placeholders a human still has to answer.
 *
 * Rendered as a visible draft notice on the policy pages while non-empty, so
 * the site never quietly presents invented legal detail as fact.
 */
export function pendingReview(): string[] {
  const missing: string[] = [];
  if (!business.address) missing.push("trading address");
  if (!business.tradeLicence) missing.push("trade licence number");
  return missing;
}

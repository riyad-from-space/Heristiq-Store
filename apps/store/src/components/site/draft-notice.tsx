import { AlertTriangle } from "lucide-react";
import { pendingReview } from "@/config/business";

/*
 * A visible notice while the policy pages still contain placeholders.
 *
 * Legal pages are the one place where inventing a plausible detail is actively
 * harmful — a trading address that does not exist, a licence number that is
 * not yours. So the pages state what they can, and this says out loud what is
 * still missing, until src/config/business.ts is filled in.
 *
 * It renders nothing once there is nothing left to fill in, so it cannot be
 * forgotten in production.
 */
export function DraftNotice() {
  const missing = pendingReview();
  if (missing.length === 0) return null;

  return (
    <div className="border-warn/40 bg-warn-wash flex items-start gap-3 border border-dashed px-4 py-3">
      <AlertTriangle size={16} className="text-warn mt-0.5 shrink-0" />
      <p className="text-warn text-copy-xs">
        <strong className="font-medium">Draft.</strong> This policy is missing
        the business&apos;s {missing.join(" and ")}. Add{" "}
        {missing.length === 1 ? "it" : "them"} in{" "}
        <code>apps/store/src/config/business.ts</code> and this notice
        disappears.
      </p>
    </div>
  );
}

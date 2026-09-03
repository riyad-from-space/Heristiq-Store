import { Ruler } from "lucide-react";

/*
 * How to pick a length.
 *
 * A waist chain is the one piece where getting the size wrong means a return,
 * and a return in Bangladeshi f-commerce means paying courier both ways on a
 * ৳300 item. So this is written to be usable with a phone charging cable and a
 * measuring tape, which is what people actually have.
 *
 * Exported as a component, not baked into the PDP, because the /size-guide
 * page in phase 6 and the footer link to it must show the same table — a
 * second copy of these numbers is a second thing to get wrong.
 */
export const LENGTH_ROWS = [
  { size: "XS", waist: "24–26 in", cm: "61–66 cm", chain: "28 in" },
  { size: "S", waist: "26–28 in", cm: "66–71 cm", chain: "30 in" },
  { size: "M", waist: "28–31 in", cm: "71–79 cm", chain: "32 in" },
  { size: "L", waist: "31–34 in", cm: "79–86 cm", chain: "34 in" },
  { size: "XL", waist: "34–38 in", cm: "86–97 cm", chain: "36 in" },
] as const;

export function SizeGuideContent({
  lengthInches,
}: {
  lengthInches?: { min: number; max: number } | null;
}) {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      {lengthInches && (
        <p className="bg-gold-wash text-gold-deep flex items-start gap-3 px-4 py-3">
          <Ruler size={16} className="mt-0.5 shrink-0" strokeWidth={1.6} />
          <span>
            This piece adjusts from{" "}
            <strong className="font-medium">
              {lengthInches.min} to {lengthInches.max} inches
            </strong>{" "}
            using the extender chain, so it fits most of the range below.
          </span>
        </p>
      )}

      <div>
        <h3 className="text-sm font-medium">How to measure</h3>
        <ol className="text-ink-muted mt-3 list-decimal space-y-2 pl-5">
          <li>
            Decide where you want it to sit — most people wear it on the hip
            bone, a few inches below the natural waist.
          </li>
          <li>
            Wrap a measuring tape around that exact spot, snug but not tight. No
            tape? Use a phone charging cable, mark it, then measure it against a
            ruler.
          </li>
          <li>
            Add 2 inches so it drapes instead of sitting flat, then find that
            number in the table.
          </li>
        </ol>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left">
          <thead>
            <tr className="border-line text-eyebrow text-ink-faint border-b uppercase">
              <th scope="col" className="py-2 pr-4 font-medium">
                Size
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Where you wear it
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                In cm
              </th>
              <th scope="col" className="py-2 font-medium">
                Chain length
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            {LENGTH_ROWS.map((row) => (
              <tr key={row.size} className="border-line border-b last:border-0">
                <th scope="row" className="py-2.5 pr-4 font-medium">
                  {row.size}
                </th>
                <td className="text-ink-muted py-2.5 pr-4">{row.waist}</td>
                <td className="text-ink-muted py-2.5 pr-4">{row.cm}</td>
                <td className="py-2.5">{row.chain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-muted text-xs">
        Between two sizes? Take the longer one — the extender shortens a chain,
        it cannot lengthen one.
      </p>
    </div>
  );
}

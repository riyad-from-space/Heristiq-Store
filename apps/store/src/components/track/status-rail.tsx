import { Check, CircleAlert, Package, Truck } from "lucide-react";
import { STATUS_META, STATUS_STEPS, type CourierStatus } from "@/lib/courier/status";
import { cn } from "@/lib/utils";

/*
 * Where the parcel is, as five steps.
 *
 * Renders a CourierStatus and nothing else — no courier name, no courier
 * vocabulary. That is the whole point of the normalisation in
 * lib/courier/status.ts: this component cannot tell whether Steadfast, Pathao
 * or RedX is carrying the parcel, so it cannot render differently for one.
 *
 * A status off the happy path (on hold, returned, lost, cancelled) has no step
 * to sit on, so the rail is replaced by a single honest panel rather than a
 * progress bar frozen somewhere misleading.
 */
export function StatusRail({ status }: { status: CourierStatus }) {
  const meta = STATUS_META[status];

  if (meta.step === null) return <ExceptionPanel status={status} />;

  return (
    <div>
      <ol className="flex items-start">
        {STATUS_STEPS.map((step, index) => {
          const done = step.step < meta.step!;
          const current = step.step === meta.step;
          const last = index === STATUS_STEPS.length - 1;

          return (
            <li
              key={step.step}
              className={cn("flex flex-1 flex-col items-center", last && "flex-none")}
              aria-current={current ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-[0.625rem] transition-colors",
                    done && "border-success bg-success text-white",
                    current && "border-ink bg-ink text-bone",
                    !done && !current && "border-line-strong text-ink-faint",
                  )}
                >
                  {done ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <span className="tnum">{step.step}</span>
                  )}
                </span>
                {!last && (
                  /* The connector belongs to the step on its left, so the
                     completed run of it reaches exactly as far as progress. */
                  <span
                    aria-hidden
                    className={cn(
                      "h-px flex-1",
                      done ? "bg-success" : "bg-line-strong",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 max-w-16 text-center text-[0.625rem] leading-tight",
                  current ? "text-ink font-medium" : "text-ink-faint",
                  last && "max-w-14",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-line bg-paper mt-8 flex items-start gap-3 border px-4 py-4">
        <span className="text-gold mt-0.5 shrink-0">
          {meta.step === 5 ? <Check size={18} /> : meta.step >= 4 ? <Truck size={18} /> : <Package size={18} />}
        </span>
        <div>
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            {meta.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExceptionPanel({ status }: { status: CourierStatus }) {
  const meta = STATUS_META[status];
  const bad = meta.tone === "bad";

  return (
    <div
      className={cn(
        "flex items-start gap-3 border px-4 py-4",
        bad ? "border-danger/30 bg-danger/5" : "border-warn/30 bg-warn/5",
      )}
    >
      <CircleAlert
        size={18}
        className={cn("mt-0.5 shrink-0", bad ? "text-danger" : "text-warn")}
      />
      <div>
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-ink-muted mt-1 text-sm leading-relaxed">{meta.detail}</p>
      </div>
    </div>
  );
}

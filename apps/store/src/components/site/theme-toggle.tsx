"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/site/theme-provider";
import type { ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
 * The theme control.
 *
 * A Radix RadioGroup, not three buttons and not a two-state switch.
 *
 * Not a switch, because there are three choices and one of them is "follow my
 * phone". A switch can only express on/off, so sites built on one either drop
 * `system` — and then a customer whose phone turns dark at sunset has to come
 * back and flip the shop by hand — or they fake it, and the switch shows
 * "light" while the page is dark.
 *
 * Not three plain buttons, because a radio group is what this is: one choice
 * out of three. Radix gives it roving-tabindex keyboard behaviour (one tab
 * stop, arrow keys to move within it), `role="radiogroup"` and correct checked
 * state, none of which three buttons have without hand-written keydown
 * handling. It is already a dependency, so this costs nothing.
 */

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({
  variant = "compact",
  inverted = false,
  className,
}: {
  /** `compact` for the header icon row, `full` for the mobile menu. */
  variant?: "compact" | "full";
  /**
   * Sitting on the transparent header over the hero.
   *
   * The hero is a dark photograph in BOTH themes, so this is not the same
   * question as which theme is active — the toggle needs white-on-transparent
   * there even in light mode, where its normal ink-faint icons and bone
   * hairline would disappear into the image.
   */
  inverted?: boolean;
  className?: string;
}) {
  const { choice, ready, setChoice } = useTheme();

  /*
   * Until localStorage has been read, no option is selected.
   *
   * This is the same guard the header's cart count uses, for the same reason:
   * the server cannot know the stored choice, so rendering one as selected
   * during the first client render would not match the server's HTML and React
   * would blame the whole subtree. An unselected group for one frame is
   * invisible in practice; a hydration error is not.
   *
   * The page is NOT unthemed during that frame — the pre-paint script in
   * lib/theme.ts has already applied the colours. Only this control's
   * selected marker waits.
   */
  const value = ready ? choice : "";

  const compact = variant === "compact";

  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => setChoice(next as ThemeChoice)}
      /* The group needs its own name for screen readers; the icons alone say
         "sun, moon, monitor" with no indication of what they control. */
      aria-label="Colour theme"
      className={cn(
        "border-line inline-flex items-center rounded-sm border p-0.5",
        compact ? "gap-0" : "w-full gap-0",
        className,
      )}
    >
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <RadioGroup.Item
          key={option}
          value={option}
          aria-label={label}
          /*
           * `title` as well as aria-label: the compact variant is icon-only,
           * and a sighted mouse user has no other way to learn which icon is
           * which. aria-label alone serves the screen reader and leaves them
           * guessing.
           */
          title={label}
          className={cn(
            "duration-quick ease-out-soft focus-visible:outline-gold relative inline-flex items-center justify-center gap-2",
            "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            "rounded-xs",
            /* data-state=checked is Radix's marker for the selected item. */
            inverted
              ? "text-white/55 hover:text-white data-[state=checked]:bg-white/15 data-[state=checked]:text-white"
              : "text-ink-faint hover:text-ink data-[state=checked]:bg-shell data-[state=checked]:text-ink",
            compact
              ? "size-8"
              : "min-h-11 flex-1 text-xs font-medium tracking-wide",
          )}
        >
          <Icon size={compact ? 15 : 16} strokeWidth={1.7} />
          {!compact && label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

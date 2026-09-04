import type { SVGProps } from "react";

/*
 * Social glyphs.
 *
 * lucide-react v1 removed its brand icons (they carry trademark terms its
 * licence will not cover), so these are drawn here. They are built from plain
 * geometry rather than transcribed from a brand asset pack: recognisable at
 * 18px in a footer, and nothing to get subtly wrong.
 *
 * If pixel-exact marks are wanted later, swap the bodies for the official SVGs
 * — the props contract stays the same.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Frame({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="12" cy="12" r="9.25" />
      {/* The "f": a stem that hooks over the top, plus a crossbar. */}
      <path d="M15 7.5h-1.4A2.1 2.1 0 0 0 11.5 9.6V21" />
      <path d="M9 12.9h5" />
    </Frame>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <Frame {...props}>
      {/* A quaver whose stem carries the flag off to the right. */}
      <circle cx="9.5" cy="17" r="3.5" />
      <path d="M13 17V3.5c1.1 2.6 2.9 4 5.5 4.2" />
    </Frame>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <Frame {...props}>
      {/* Speech bubble with the tail bottom-left, and a handset inside. */}
      <path d="M20.5 11.6a8.5 8.5 0 1 1-4.3-7.4 8.5 8.5 0 0 1 4.3 7.4Z" />
      <path d="M12 20.1a8.5 8.5 0 0 1-4.4-1.2L3.5 20l1.2-4a8.5 8.5 0 0 0 7.3 4.1Z" />
      <path d="M9.4 9.1c.3 1.7 1.7 3.1 3.4 3.5l.9-1 1.6.8-.3 1.3c-2.6.2-5.4-2.4-5.7-5.1l1.3-.3.8 1.6Z" />
    </Frame>
  );
}

export function MessengerIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 3c5 0 9 3.7 9 8.4 0 4.6-4 8.4-9 8.4a10 10 0 0 1-2.7-.4L5 21l1-3.2A8 8 0 0 1 3 11.4C3 6.7 7 3 12 3Z" />
      {/* The lightning bolt, as the double-back stroke it actually is. */}
      <path d="M7.8 14.2l2.9-3.1 2 1.7 2.6-2.9-2.9 3.1-2-1.7-2.6 2.9Z" />
    </Frame>
  );
}

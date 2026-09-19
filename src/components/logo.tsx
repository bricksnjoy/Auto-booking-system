import Image from "next/image";

/**
 * The Spruce & Co monogram. `onDark` picks the white cutout for navy
 * surfaces; otherwise the navy mark is used.
 */
export function Logo({
  size = 32,
  onDark = false,
  className = "",
}: {
  size?: number;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={onDark ? "/logo-mark-white.png" : "/logo-mark.png"}
      alt="Spruce &amp; Co"
      width={size}
      height={size}
      priority
      className={className}
    />
  );
}

/** Monogram on a navy tile — used where the surface behind is light. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]"
      style={{ width: size, height: size }}
    >
      <Logo size={Math.round(size * 0.7)} onDark />
    </span>
  );
}

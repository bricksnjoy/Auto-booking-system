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

/**
 * The company wordmark: name in the brand display face (Boston Angel Bold,
 * falling back to Playfair Display until the licensed file is installed),
 * with PRIVATE LIMITED beneath it in DM Sans.
 */
export function Wordmark({
  size = "md",
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const scale = {
    sm: { name: "text-[15px]", sub: "text-[8px] tracking-[0.18em]" },
    md: { name: "text-xl", sub: "text-[9px] tracking-[0.2em]" },
    lg: { name: "text-3xl", sub: "text-[11px] tracking-[0.22em]" },
  }[size];

  return (
    <span className="flex flex-col leading-none">
      <span
        className={`font-display font-bold ${scale.name} ${
          onDark ? "text-white" : "text-[var(--brand)]"
        }`}
      >
        Spruce &amp; Co
      </span>
      <span
        className={`mt-1 font-sans font-normal uppercase ${scale.sub} ${
          onDark ? "text-white/70" : "text-[var(--muted)]"
        }`}
      >
        Private Limited
      </span>
    </span>
  );
}

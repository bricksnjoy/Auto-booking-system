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
 * falling back to Cormorant Garamond until the licensed file is installed),
 * with PRIVATE LIMITED beneath it in Poppins.
 *
 * The ampersand is drawn from a plain serif rather than the display face —
 * decorative faces tend to ship an "Et"-style swash ampersand, which is not
 * the form used in the company lockup.
 */
export function Wordmark({
  size = "md",
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const scale = {
    sm: { name: "text-[15px]", sub: "text-[10px]", gap: "mt-0.5" },
    md: { name: "text-xl", sub: "text-[13px]", gap: "mt-1" },
    lg: { name: "text-3xl", sub: "text-[18px]", gap: "mt-1.5" },
  }[size];

  return (
    <span className="flex flex-col items-center leading-none">
      <span
        className={`font-display font-bold ${scale.name} ${
          onDark ? "text-white" : "text-[var(--brand)]"
        }`}
      >
        Spruce{" "}
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>&amp;</span>{" "}
        Co
      </span>
      <span
        className={`${scale.gap} font-sans font-normal uppercase tracking-[0.02em] ${scale.sub} ${
          onDark ? "text-white/85" : "text-[var(--text)]"
        }`}
      >
        Private Limited
      </span>
    </span>
  );
}

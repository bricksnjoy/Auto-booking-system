/**
 * Spruce & Co monogram. `onDark` renders the mark in white for the navy
 * background; otherwise it draws in brand navy.
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
  const fill = onDark ? "#ffffff" : "var(--brand)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Spruce &amp; Co"
    >
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill={fill}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="62"
        letterSpacing="-6"
      >
        SC
      </text>
    </svg>
  );
}

/** Monogram inside the navy tile, as used in the sidebar and on the login card. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]"
      style={{ width: size, height: size }}
    >
      <Logo size={size * 0.72} onDark />
    </span>
  );
}

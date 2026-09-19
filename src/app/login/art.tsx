/**
 * Artwork panel for the login screen. Drafting-style line work in the brand
 * palette: a blueprint field, a floor plan, a dimensioned elevation and a
 * tower crane — construction and interior design in one composition.
 * Drawn as inline SVG so it scales cleanly and costs no extra request.
 */
export function LoginArt() {
  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#1b263b" />
          <stop offset="55%" stopColor="#0d1b2a" />
          <stop offset="100%" stopColor="#0a1622" />
        </linearGradient>

        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 H0 V40" fill="none" stroke="#778da9" strokeWidth="0.5" opacity="0.13" />
        </pattern>

        <pattern id="gridFine" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0 H0 V8" fill="none" stroke="#778da9" strokeWidth="0.3" opacity="0.07" />
        </pattern>

        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1b2a" stopOpacity="0" />
          <stop offset="100%" stopColor="#0d1b2a" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <rect width="800" height="1000" fill="url(#sky)" />
      <rect width="800" height="1000" fill="url(#gridFine)" />
      <rect width="800" height="1000" fill="url(#grid)" />

      {/* survey arcs */}
      <g fill="none" stroke="#778da9" opacity="0.18">
        <circle cx="720" cy="250" r="200" strokeWidth="1" />
        <circle cx="720" cy="250" r="300" strokeWidth="1" />
        <circle cx="720" cy="250" r="410" strokeWidth="0.75" />
      </g>

      {/* ---- floor plan: interior design ---- */}
      <g stroke="#e8e6e0" fill="none" opacity="0.5" strokeWidth="1.6">
        <path d="M70 120 H330 V300 H70 Z" />
        <path d="M70 215 H196" />
        <path d="M196 215 V300" />
        {/* door swing */}
        <path d="M196 215 A46 46 0 0 1 242 261" strokeWidth="1" opacity="0.7" />
        <path d="M242 261 V215" strokeWidth="1" opacity="0.7" />
        {/* window openings */}
        <path d="M120 120 H176" stroke="#778da9" strokeWidth="4" />
        <path d="M246 120 H302" stroke="#778da9" strokeWidth="4" />
      </g>

      {/* furniture glyphs */}
      <g stroke="#778da9" fill="none" opacity="0.55" strokeWidth="1.3">
        <rect x="92" y="240" width="74" height="42" rx="6" />
        <path d="M92 261 H166" />
        <circle cx="286" cy="170" r="17" />
        <path d="M286 153 V187 M269 170 H303" strokeWidth="0.9" />
      </g>

      {/* ---- dimension line ---- */}
      <g stroke="#778da9" opacity="0.65" strokeWidth="1">
        <path d="M70 336 H330" />
        <path d="M70 328 V344 M330 328 V344" />
        <path d="M78 332 L70 336 L78 340 M322 332 L330 336 L322 340" fill="#778da9" />
      </g>

      {/* ---- elevation: construction ---- */}
      <g opacity="0.95">
        <rect x="120" y="560" width="150" height="440" fill="#0a1622" stroke="#778da9" strokeWidth="1.4" opacity="0.9" />
        <rect x="290" y="470" width="190" height="530" fill="#101f31" stroke="#778da9" strokeWidth="1.4" opacity="0.92" />
        <rect x="500" y="620" width="130" height="380" fill="#0a1622" stroke="#778da9" strokeWidth="1.4" opacity="0.9" />
        <rect x="650" y="700" width="110" height="300" fill="#101f31" stroke="#778da9" strokeWidth="1.2" opacity="0.85" />
      </g>

      {/* windows */}
      <g fill="#e8e6e0">
        {Array.from({ length: 9 }).map((_, r) =>
          Array.from({ length: 3 }).map((__, c) => (
            <rect
              key={`a${r}${c}`}
              x={140 + c * 38}
              y={590 + r * 44}
              width={20}
              height={24}
              opacity={(r * 3 + c) % 4 === 0 ? 0.3 : 0.1}
            />
          )),
        )}
        {Array.from({ length: 11 }).map((_, r) =>
          Array.from({ length: 4 }).map((__, c) => (
            <rect
              key={`b${r}${c}`}
              x={312 + c * 42}
              y={500 + r * 44}
              width={22}
              height={26}
              opacity={(r + c) % 3 === 0 ? 0.34 : 0.12}
            />
          )),
        )}
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 2 }).map((__, c) => (
            <rect
              key={`c${r}${c}`}
              x={522 + c * 46}
              y={650 + r * 44}
              width={22}
              height={26}
              opacity={(r + c) % 2 === 0 ? 0.26 : 0.1}
            />
          )),
        )}
      </g>

      {/* ---- tower crane ---- */}
      <g stroke="#e8e6e0" fill="none" opacity="0.62" strokeWidth="1.6">
        <path d="M600 210 V560" />
        <path d="M592 210 H608" />
        <path d="M470 210 H720" />
        <path d="M470 210 L600 170 L720 210" strokeWidth="1" opacity="0.7" />
        <path d="M600 170 V210" strokeWidth="1" opacity="0.7" />
        {/* hoist */}
        <path d="M520 210 V300" strokeWidth="1" />
        <rect x="506" y="300" width="28" height="18" strokeWidth="1.2" />
        {/* mast lattice */}
        <g strokeWidth="0.8" opacity="0.6">
          <path d="M592 250 L608 290 M608 250 L592 290 M592 330 L608 370 M608 330 L592 370 M592 410 L608 450 M608 410 L592 450 M592 490 L608 530 M608 490 L592 530" />
          <path d="M592 250 H608 M592 290 H608 M592 330 H608 M592 370 H608 M592 410 H608 M592 450 H608 M592 490 H608 M592 530 H608" />
        </g>
      </g>

      {/* ground line */}
      <path d="M0 1000 H800" stroke="#778da9" strokeWidth="1.5" opacity="0.5" />
      <rect y="700" width="800" height="300" fill="url(#fade)" />
    </svg>
  );
}

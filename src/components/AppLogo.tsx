interface AppLogoProps {
  className?: string;
  size?: number;
}

// Redesigned logo: M↓ glyph inside a circular ring. Ring proportions match the
// reference RedesignedLogo.png: outer radius ~50% of viewBox, stroke ~5%, glyph
// scaled to fit ~52% of inner diameter and centered on the ring.
//
// viewBox is square (64x64) so the SVG can be sized by either dimension.
// `currentColor` keeps the logo monochrome and themable via CSS color.
export function AppLogo({ className, size = 18 }: AppLogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="29.5"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      {/* M↓ glyph from the original AppLogo (viewBox 0 0 64 57), translated
          and scaled to fit centered inside the ring. The glyph is ~58 units
          tall in source space; scaling by ~0.55 + translation places it inside
          a ~32-unit safe area centered at (32,32). */}
      <g transform="translate(15.05, 14.5) scale(0.55)">
        <path d="M29 32.6543V52.6768L28.9053 52.79L4 23.2461V2.99902L29 32.6543Z" fill="currentColor" />
        <path d="M16 47C16 50.3137 13.3137 53 10 53C6.68629 53 4 50.3137 4 47C4 43.6863 6.68629 41 10 41C13.3137 41 16 43.6863 16 47Z" fill="currentColor" />
        <path d="M47 3H60V53H47V3Z" fill="currentColor" />
        <path d="M44.6426 3.13574L44.6504 18.4209L32.3447 30.7393L25.2354 22.292L44.5068 3L44.6426 3.13574Z" fill="currentColor" />
      </g>
    </svg>
  );
}

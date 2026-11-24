export function BrandLogo({
  size = 28,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Swiss Architectural Folio Frame */}
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="13"
        fill="var(--bg-paper)"
        stroke="var(--border-strong)"
        strokeWidth="1.6"
      />
      {/* Left archival binding hairline */}
      <line
        x1="17"
        y1="12"
        x2="17"
        y2="52"
        stroke="var(--border-strong)"
        strokeWidth="1.2"
        strokeDasharray="2.5 2.5"
      />
      {/* Open-top U-shaped folio sheet silhouette */}
      <path
        d="M23 16V37C23 44.18 28.82 50 36 50C43.18 50 49 44.18 49 37V16"
        stroke="var(--ink-primary)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Calligraphic mathematical integral / inflection stroke */}
      <path
        d="M40.5 17.5C37.2 17.5 35.8 20.4 35.2 26.2L34.2 35.8C33.6 41.2 32.1 43.8 29 43.8"
        stroke="var(--accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Editorial registration node echoing USTC route rail */}
      <circle cx="46.5" cy="18.5" r="3" fill="var(--bg-paper)" stroke="var(--amber)" strokeWidth="2" />
    </svg>
  )
}

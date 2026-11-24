export function BrandLogo({
  size = 26,
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
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Swiss geometric Q ring with crisp 45° lower-right aperture */}
      <path
        d="M23.5 21.1A10.5 10.5 0 1 1 21.1 23.5"
        stroke="var(--ink-primary)"
        strokeWidth="3.6"
        strokeLinecap="butt"
      />
      {/* Precision cobalt-blue diagonal nib / Q-tail facet */}
      <path
        d="M17.2 17.2L20.4 17.2L27.8 24.6L24.6 27.8L17.2 20.4Z"
        fill="var(--accent)"
      />
    </svg>
  )
}

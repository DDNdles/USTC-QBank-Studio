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
      {/* Centered geometric ring (cx=14.5, cy=14.5, r=10) with crisp 20° aperture at 45° */}
      <path
        d="M20.24 22.69A10 10 0 1 1 22.69 20.24"
        stroke="var(--ink-primary)"
        strokeWidth="3.5"
        strokeLinecap="butt"
      />
      {/* Precision cobalt-blue 45° diagonal tail / nib bisecting the aperture */}
      <path
        d="M17.2 17.2L20.1 17.2L27.8 24.9L24.9 27.8L17.2 20.1Z"
        fill="var(--accent)"
      />
    </svg>
  )
}

import { useId } from 'react'

export function BrandLogo({
  size = 28,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const clipId = useId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="USTC QBank Studio"
      className={`inline-block shrink-0 select-none ${className}`}
    >
      <clipPath id={clipId}>
        <rect x="14" y="14" width="484" height="484" rx="116" />
      </clipPath>
      <rect
        x="14"
        y="14"
        width="484"
        height="484"
        rx="116"
        fill="var(--logo-bg)"
        stroke="var(--logo-border)"
        strokeWidth="8"
      />
      <g clipPath={`url(#${clipId})`} stroke="var(--logo-arc)" strokeWidth="5">
        <circle cx="512" cy="512" r="150" />
        <circle cx="512" cy="512" r="215" />
        <circle cx="512" cy="512" r="280" strokeDasharray="10 18" strokeLinecap="round" />
      </g>
      <path
        d="M138 100 H298 L374 176 V412 H138 Z"
        fill="var(--logo-doc-fill)"
        stroke="var(--logo-stroke)"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      <path
        d="M298 100 L374 176 H298 Z"
        fill="var(--logo-accent)"
        stroke="var(--logo-stroke)"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      <rect x="186" y="150" width="26" height="26" rx="5" fill="var(--logo-accent)" />
      <line
        x1="186"
        y1="236"
        x2="326"
        y2="236"
        stroke="var(--logo-stroke)"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <line
        x1="186"
        y1="292"
        x2="326"
        y2="292"
        stroke="var(--logo-stroke)"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <line
        x1="186"
        y1="348"
        x2="266"
        y2="348"
        stroke="var(--logo-accent)"
        strokeWidth="20"
        strokeLinecap="round"
      />
    </svg>
  )
}

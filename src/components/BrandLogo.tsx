export function BrandLogo({
  size = 28,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src="./images/brand-logo.png"
      alt="USTC QBank Studio"
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 rounded-[22%] object-contain select-none ${className}`}
    />
  )
}

interface BrandMarkProps {
  size?: number
  decorative?: boolean
}

export function BrandMark({ size = 24, decorative = true }: BrandMarkProps): React.JSX.Element {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Porticle'}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M10 24V9.5C10 8.67 10.67 8 11.5 8H18.2C21.96 8 24 10.2 24 13.5C24 16.8 21.96 19 18.2 19H14"
        stroke="var(--mark-ink)"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="13.5" r="1.75" fill="var(--mark-ink)" />
    </svg>
  )
}

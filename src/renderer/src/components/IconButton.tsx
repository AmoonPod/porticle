import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  label: string
  size?: 'small' | 'medium'
}

export function IconButton({
  icon: Icon,
  label,
  size = 'medium',
  className = '',
  ...props
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`icon-button icon-button--${size} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.9} />
    </button>
  )
}

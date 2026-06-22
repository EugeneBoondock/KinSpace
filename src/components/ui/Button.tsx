import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { playSfx } from '@/lib/audio/sfx'

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-brand-primary disabled:opacity-50 disabled:pointer-events-none active:translate-y-0'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-background text-brand-primary hover:bg-brand-background/95 hover:-translate-y-px shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]',
  secondary: 'border border-brand-background/25 bg-brand-background/[0.04] text-brand-background hover:bg-brand-background/10 hover:border-brand-background/40',
  accent: 'bg-brand-accent1 text-[#2a140b] hover:-translate-y-px hover:brightness-105 shadow-[0_10px_28px_-10px_rgba(207,111,68,0.55)]',
  ghost: 'text-brand-background/80 hover:text-brand-background hover:bg-brand-background/10',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-6 text-sm',
  lg: 'h-12 px-8 text-base',
}

type CommonProps = {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  fullWidth?: boolean
  leadingIcon?: ReactNode
  /** Suppress the subtle click sound (e.g. for high-frequency or silent actions). */
  silent?: boolean
  className?: string
  children: ReactNode
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leadingIcon,
  silent = false,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!silent) playSfx('tap')
    onClick?.(event)
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...rest}
    >
      {isLoading ? <Spinner /> : leadingIcon}
      {children}
    </button>
  )
}

type LinkButtonProps = CommonProps & { href: string; external?: boolean }

export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  className,
  children,
  href,
  external,
}: LinkButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {leadingIcon}
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {leadingIcon}
      {children}
    </Link>
  )
}

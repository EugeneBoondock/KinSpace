import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const fieldBase =
  'w-full rounded-xl bg-brand-ink/[0.04] border border-brand-line-strong px-4 py-3 text-sm ' +
  'text-brand-ink placeholder:text-brand-ink/40 transition-colors ' +
  'focus:outline-none focus:border-brand-accent2/55 focus:ring-2 focus:ring-brand-accent2/15 ' +
  'disabled:opacity-50 aria-[invalid=true]:border-brand-crisis/70'

export type InputProps = InputHTMLAttributes<HTMLInputElement>
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, className)} {...rest} />
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>
export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return <textarea rows={rows} className={cn(fieldBase, 'resize-y', className)} {...rest} />
}

export function Label({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-brand-ink/90', className)}>
      {children}
      {required && <span className="ml-0.5 text-brand-accent1">*</span>}
    </label>
  )
}

type FieldProps = {
  label?: string
  htmlFor?: string
  required?: boolean
  error?: string | null
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, required, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-brand-crisis">{error}</p>
      ) : hint ? (
        <p className="text-xs text-brand-ink/50">{hint}</p>
      ) : null}
    </div>
  )
}

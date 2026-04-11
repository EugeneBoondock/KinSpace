import type { ReactNode } from 'react'
import { classNames } from '@/lib/platform'

interface PageFrameProps {
  children: ReactNode
  className?: string
  containerClassName?: string
}

export default function PageFrame({
  children,
  className,
  containerClassName,
}: PageFrameProps) {
  return (
    <div className={classNames('page-shell', className)}>
      <div className={classNames('page-container', containerClassName)}>{children}</div>
    </div>
  )
}

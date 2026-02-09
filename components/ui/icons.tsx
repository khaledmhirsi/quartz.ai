'use client'

import Image from 'next/image'

import { cn } from '@/lib/utils'

interface IconLogoProps {
  className?: string
}

function IconLogo({ className }: IconLogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt="Quartz Logo"
      width={16}
      height={16}
      className={cn('h-4 w-4', className)}
    />
  )
}

function IconLogoOutline({ className }: IconLogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt="Quartz Logo"
      width={16}
      height={16}
      className={cn('h-4 w-4', className)}
    />
  )
}

function IconBlinkingLogo({ className }: IconLogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt="Quartz Logo"
      width={16}
      height={16}
      className={cn('h-4 w-4', className)}
    />
  )
}

export { IconBlinkingLogo, IconLogo, IconLogoOutline }

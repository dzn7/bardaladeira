'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { HelpCircle, Moon, Sun } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

type HeaderProps = { onAbrirAjuda?: () => void }

export default function Header({ onAbrirAjuda }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    setMounted(true)

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 border-b transition-colors ${
        scrolled
          ? 'border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'
          : 'border-border/70 bg-background/95'
      }`}
    >
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card">
              <Image
                src="/logo.webp"
                alt="Bar da Ladeira"
                width={44}
                height={44}
                className="h-9 w-9 rounded-sm object-contain"
                priority
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight text-foreground md:text-lg">
                Bar da Ladeira
              </h1>
              <p className="text-xs text-muted-foreground">Delivery</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onAbrirAjuda && (
              <Button type="button" variant="ghost" size="icon" onClick={onAbrirAjuda} aria-label="Como pedir" className="shrink-0">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Alternar tema"
              className="shrink-0"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5 text-dourado-400" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

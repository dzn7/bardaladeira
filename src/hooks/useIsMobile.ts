'use client'

import { useEffect, useState } from 'react'

const BREAKPOINT_MOBILE = 768

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${BREAKPOINT_MOBILE - 1}px)`)
    const handleChange = () => setIsMobile(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}

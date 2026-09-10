'use client'

import { useEffect } from 'react'

export function LandingMotion() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.landing-animate'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    )

    items.forEach((item, index) => {
      item.style.setProperty('--reveal-delay', `${Math.min(index % 8, 6) * 70}ms`)
      observer.observe(item)
    })

    return () => observer.disconnect()
  }, [])

  return null
}

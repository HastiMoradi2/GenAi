import { useEffect } from 'react'
import gsap from 'gsap'

export function useMagicCards({ particleCount = 12, spotlightRadius = 400 } = {}) {
  useEffect(() => {
    /* ── Spotlight ── */
    const spotlight = document.createElement('div')
    spotlight.className = 'magic-spotlight'
    document.body.appendChild(spotlight)

    function onMouseMove(e) {
      gsap.to(spotlight, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: true,
      })

      /* directional border glow */
      const card = e.target.closest('.card')
      if (card) {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`)
        card.style.setProperty('--my', `${e.clientY - rect.top}px`)
      }
    }

    /* ── Click ripple ── */
    function onClick(e) {
      const card = e.target.closest('.card')
      if (!card) return
      const rect = card.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const ripple = document.createElement('span')
      ripple.className = 'magic-ripple'
      ripple.style.cssText = `
        width:${size}px;height:${size}px;
        left:${e.clientX - rect.left - size / 2}px;
        top:${e.clientY - rect.top - size / 2}px;
      `
      card.appendChild(ripple)
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
    }

    /* ── Particles ── */
    function spawnParticles(card) {
      const rect = card.getBoundingClientRect()
      for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div')
        const size = Math.random() * 4 + 2
        const colors = ['132,0,255', '106,78,212', '156,120,228', '200,180,255']
        const color = colors[Math.floor(Math.random() * colors.length)]
        p.style.cssText = `
          position:fixed;
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:rgba(${color},${(Math.random() * 0.5 + 0.5).toFixed(2)});
          pointer-events:none;
          z-index:9999;
          left:${rect.left + Math.random() * rect.width}px;
          top:${rect.top + Math.random() * rect.height * 0.6 + rect.height * 0.2}px;
        `
        document.body.appendChild(p)
        gsap.to(p, {
          x: (Math.random() - 0.5) * 90,
          y: -(Math.random() * 70 + 20),
          opacity: 0,
          scale: Math.random() * 0.5 + 0.5,
          duration: Math.random() * 0.7 + 0.4,
          ease: 'power2.out',
          delay: Math.random() * 0.18,
          onComplete: () => p.remove(),
        })
      }
    }

    /* ── Attach per-card listeners ── */
    function attachListeners() {
      document.querySelectorAll('.card:not([data-magic])').forEach(card => {
        card.dataset.magic = '1'
        card.addEventListener('mouseenter', () => spawnParticles(card))
      })
    }

    const observer = new MutationObserver(attachListeners)
    observer.observe(document.body, { childList: true, subtree: true })
    attachListeners()

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('click', onClick)
      observer.disconnect()
      spotlight.remove()
    }
  }, [])
}

import { describe, it, expect } from 'vitest'
import {
  isActivePath,
  primaryNavLinks,
  quoteCta,
  footerNavLinks,
} from './nav'

describe('isActivePath — helper de enlace activo', () => {
  it('returns true for an exact match on root /', () => {
    expect(isActivePath('/', '/')).toBe(true)
  })

  it('returns false when root / is compared to a different path', () => {
    expect(isActivePath('/paneles', '/')).toBe(false)
  })

  it('returns true when current path starts with a non-root href', () => {
    expect(isActivePath('/paneles/detalle', '/paneles')).toBe(true)
  })

  it('returns true for an exact match on a non-root path', () => {
    expect(isActivePath('/paneles', '/paneles')).toBe(true)
  })

  it('returns false for a non-matching path', () => {
    expect(isActivePath('/casas', '/paneles')).toBe(false)
  })

  it('root / does NOT prefix-match /paneles', () => {
    // Every path starts with '/', so root must use exact match only
    expect(isActivePath('/paneles', '/')).toBe(false)
  })

  it('returns true for /casas matching /casas/detalle', () => {
    expect(isActivePath('/casas/detalle', '/casas')).toBe(true)
  })

  it('returns false for /contacto when href is /casas', () => {
    expect(isActivePath('/contacto', '/casas')).toBe(false)
  })

  it('does NOT prefix-match across a segment boundary', () => {
    // '/paneles-sip' must not activate the '/paneles' link
    expect(isActivePath('/paneles-sip', '/paneles')).toBe(false)
  })
})

describe('navegación pública — fuente de verdad', () => {
  it('exposes the main catalog sections in discovery order', () => {
    expect(primaryNavLinks.map((l) => l.href)).toEqual([
      '/',
      '/paneles',
      '/casas',
    ])
  })

  it('starts the primary nav with an explicit Inicio link', () => {
    expect(primaryNavLinks[0]).toEqual({ href: '/', label: 'Inicio' })
  })

  it('points the quote CTA to the contact page', () => {
    expect(quoteCta.href).toBe('/contacto')
  })

  it('keeps the primary sections out of the quote CTA', () => {
    expect(primaryNavLinks.some((l) => l.href === quoteCta.href)).toBe(false)
  })

  it('lists every public section in the footer, contact included', () => {
    expect(footerNavLinks.map((l) => l.href)).toEqual([
      '/',
      '/paneles',
      '/casas',
      '/contacto',
    ])
  })

  it('labels the footer contact link descriptively, not as the CTA verb', () => {
    const contact = footerNavLinks.find((l) => l.href === '/contacto')
    expect(contact?.label).toBe('Contacto')
  })
})

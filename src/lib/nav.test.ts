import { describe, it, expect } from 'vitest'
import { isActivePath } from './nav'

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

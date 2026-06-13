import { describe, it, expect } from 'vitest'
import { resolveInitialTheme, nextTheme } from './theme'

describe('resolveInitialTheme', () => {
  it('respeta la preferencia guardada "dark" por sobre el sistema', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark')
  })

  it('respeta la preferencia guardada "light" por sobre el sistema', () => {
    expect(resolveInitialTheme('light', true)).toBe('light')
  })

  it('usa el sistema (dark) cuando no hay preferencia guardada', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark')
  })

  it('usa el sistema (light) cuando no hay preferencia guardada', () => {
    expect(resolveInitialTheme(null, false)).toBe('light')
  })

  it('ignora un valor guardado inválido y cae al sistema', () => {
    expect(resolveInitialTheme('banana', true)).toBe('dark')
    expect(resolveInitialTheme('', false)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('alterna de dark a light', () => {
    expect(nextTheme('dark')).toBe('light')
  })

  it('alterna de light a dark', () => {
    expect(nextTheme('light')).toBe('dark')
  })
})

import { describe, it, expect } from 'vitest'
import { parsePanelForm, panelFormErrorMessage } from './panel-form'

// ---------------------------------------------------------------------------
// Helper: build a FormData-like from a plain record (mirrors how a browser
// form submits — every value is a string; absent keys return null).
// ---------------------------------------------------------------------------

function form(fields: Record<string, string>): { get: (k: string) => string | null } {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return { get: (k: string) => fd.get(k) as string | null }
}

// ---------------------------------------------------------------------------
// parsePanelForm — required fields
// ---------------------------------------------------------------------------

describe('parsePanelForm — campos requeridos', () => {
  it('nombre y espesor_mm válidos → ok', () => {
    const result = parsePanelForm(form({ nombre: 'Panel 100', espesor_mm: '100' }))
    expect(result.ok).toBe(true)
  })

  it('nombre ausente → missing_fields', () => {
    const result = parsePanelForm(form({ espesor_mm: '100' }))
    expect(result).toEqual({ ok: false, code: 'missing_fields' })
  })

  it('nombre solo espacios → missing_fields', () => {
    const result = parsePanelForm(form({ nombre: '   ', espesor_mm: '100' }))
    expect(result).toEqual({ ok: false, code: 'missing_fields' })
  })

  it('espesor_mm ausente → missing_fields', () => {
    const result = parsePanelForm(form({ nombre: 'Panel' }))
    expect(result).toEqual({ ok: false, code: 'missing_fields' })
  })

  it('espesor_mm no numérico → invalid_numbers', () => {
    const result = parsePanelForm(form({ nombre: 'Panel', espesor_mm: 'abc' }))
    expect(result).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('espesor_mm cero o negativo → invalid_numbers', () => {
    expect(parsePanelForm(form({ nombre: 'Panel', espesor_mm: '0' }))).toEqual({ ok: false, code: 'invalid_numbers' })
    expect(parsePanelForm(form({ nombre: 'Panel', espesor_mm: '-5' }))).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('espesor_mm decimal → invalid_numbers (debe ser entero)', () => {
    const result = parsePanelForm(form({ nombre: 'Panel', espesor_mm: '10.5' }))
    expect(result).toEqual({ ok: false, code: 'invalid_numbers' })
  })
})

// ---------------------------------------------------------------------------
// parsePanelForm — defaults
// ---------------------------------------------------------------------------

describe('parsePanelForm — defaults', () => {
  it('solo requeridos → aplica defaults documentados', () => {
    const result = parsePanelForm(form({ nombre: 'Panel', espesor_mm: '120' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      nombre: 'Panel',
      espesor_mm: 120,
      ancho_mm: 1220,
      largo_mm: 2440,
      stock: 0,
      publicado: false,
      descripcion: null,
      r_value: null,
      peso_kg_m2: null,
      precio_clp: null,
      imagenes: [],
      archivos: [],
    })
  })

  it('ancho_mm y largo_mm vacíos → usan defaults 1220 / 2440', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', ancho_mm: '', largo_mm: '' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ancho_mm).toBe(1220)
    expect(result.value.largo_mm).toBe(2440)
  })
})

// ---------------------------------------------------------------------------
// parsePanelForm — opcionales y tipos
// ---------------------------------------------------------------------------

describe('parsePanelForm — campos opcionales', () => {
  it('mapea todos los campos cuando vienen completos', () => {
    const result = parsePanelForm(
      form({
        nombre: 'Panel SIP 150',
        descripcion: 'Aislante reforzado',
        espesor_mm: '150',
        ancho_mm: '1200',
        largo_mm: '2400',
        r_value: '3.5',
        peso_kg_m2: '12.4',
        precio_clp: '250000',
        stock: '8',
        publicado: 'on',
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      nombre: 'Panel SIP 150',
      descripcion: 'Aislante reforzado',
      espesor_mm: 150,
      ancho_mm: 1200,
      largo_mm: 2400,
      r_value: 3.5,
      peso_kg_m2: 12.4,
      precio_clp: 250000,
      stock: 8,
      publicado: true,
      imagenes: [],
      archivos: [],
    })
  })

  it('descripcion vacía → null', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', descripcion: '   ' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.descripcion).toBeNull()
  })

  it('r_value no numérico → invalid_numbers', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', r_value: 'x' }))
    expect(result).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('precio_clp negativo → invalid_numbers', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', precio_clp: '-1' }))
    expect(result).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('r_value > 99.99 → invalid_numbers (DECIMAL(4,2))', () => {
    expect(parsePanelForm(form({ nombre: 'P', espesor_mm: '90', r_value: '100' }))).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('r_value 99.99 (límite) → ok', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', r_value: '99.99' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.r_value).toBe(99.99)
  })

  it('peso_kg_m2 > 9999.99 → invalid_numbers (DECIMAL(6,2))', () => {
    expect(parsePanelForm(form({ nombre: 'P', espesor_mm: '90', peso_kg_m2: '10000' }))).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('precio_clp fuera del rango de INTEGER → invalid_numbers', () => {
    expect(parsePanelForm(form({ nombre: 'P', espesor_mm: '90', precio_clp: '99999999999' }))).toEqual({ ok: false, code: 'invalid_numbers' })
  })

  it('stock 0 explícito → 0 (no default)', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90', stock: '0' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.stock).toBe(0)
  })

  it('publicado ausente → false', () => {
    const result = parsePanelForm(form({ nombre: 'P', espesor_mm: '90' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.publicado).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// panelFormErrorMessage
// ---------------------------------------------------------------------------

describe('panelFormErrorMessage', () => {
  it.each(['missing_fields', 'invalid_numbers', 'db_error', 'server_error'])(
    'código conocido "%s" → mensaje en español no vacío',
    (code) => {
      const msg = panelFormErrorMessage(code)
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).not.toBe(code)
    }
  )

  it('código desconocido → cadena vacía', () => {
    expect(panelFormErrorMessage('xyz')).toBe('')
  })

  it('null → cadena vacía', () => {
    expect(panelFormErrorMessage(null)).toBe('')
  })
})
